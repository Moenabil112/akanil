import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditEventWriter } from "../audit/audit-event.writer";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface OnboardingStatusRow {
  institution_id: string;
  enterprise_id: string;
  display_name: string;
  account_id: string | null;
  account_name: string | null;
  iam_binding_status: string | null;
  account_status: string | null;
  primary_admin_user_id: string | null;
  activated_at: Date | null;
  login_enabled: boolean;
  active_agreement_count: number;
  connected_private_source_count: number;
  term_sheet_required_count: number;
}

@Injectable()
export class InstitutionOnboardingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditEventWriter,
  ) {}

  async status(institutionId: string, actor: AuthenticatedActor) {
    await this.requireInstitutionVisibility(institutionId, actor);

    const result = await this.database.query<OnboardingStatusRow>(
      `SELECT *
         FROM qassas_core.institution_onboarding_status
        WHERE institution_id = $1
        LIMIT 1`,
      [institutionId],
    );

    const row = result.rows[0];
    if (!row) throw new NotFoundException();

    return {
      institution_id: row.institution_id,
      enterprise_id: row.enterprise_id,
      display_name: row.display_name,
      account: {
        account_id: row.account_id,
        account_name: row.account_name,
        iam_binding_status: row.iam_binding_status,
        status: row.account_status,
        primary_admin_user_id: row.primary_admin_user_id,
        activated_at: row.activated_at?.toISOString() ?? null,
        login_enabled: row.login_enabled,
      },
      contractual_access: {
        active_agreement_count: Number(row.active_agreement_count ?? 0),
        connected_private_source_count: Number(
          row.connected_private_source_count ?? 0,
        ),
        term_sheet_required_count: Number(row.term_sheet_required_count ?? 0),
      },
    };
  }

  async recordAgreement(
    actor: AuthenticatedActor,
    input: {
      institution_id?: string;
      agreement_id?: string;
      agreement_type?: "TERM_SHEET" | "DATA_SHARING_AGREEMENT" | "NDA" | "PILOT_AGREEMENT";
      agreement_status?: "DRAFT" | "SIGNED" | "ACTIVE" | "EXPIRED" | "TERMINATED";
      document_ref?: string;
      document_hash?: string;
      allowed_domains?: string[];
      effective_from?: string | null;
      effective_to?: string | null;
    },
    correlationId: string,
  ) {
    this.requireSystemAdmin(actor);

    const institutionId = input.institution_id?.trim();
    const documentRef = input.document_ref?.trim();
    const documentHash = input.document_hash?.trim().toLowerCase();
    const agreementType = input.agreement_type ?? "TERM_SHEET";
    const agreementStatus = input.agreement_status ?? "SIGNED";

    if (!institutionId || !documentRef || !documentHash) {
      throw new BadRequestException(
        "institution_id, document_ref and document_hash are required",
      );
    }
    if (!/^[a-f0-9]{64}$/.test(documentHash)) {
      throw new BadRequestException("document_hash must be a SHA-256 hex digest");
    }

    const effectiveFrom = input.effective_from
      ? new Date(input.effective_from)
      : agreementStatus === "ACTIVE"
        ? new Date()
        : null;
    const effectiveTo = input.effective_to ? new Date(input.effective_to) : null;

    if (
      (effectiveFrom && Number.isNaN(effectiveFrom.getTime())) ||
      (effectiveTo && Number.isNaN(effectiveTo.getTime()))
    ) {
      throw new BadRequestException("agreement effective dates must be ISO timestamps");
    }

    const agreementId =
      input.agreement_id?.trim() || `AGR-${randomUUID()}`;

    return this.database.transaction(async (client) => {
      const institution = await client.query<{
        enterprise_id: string;
      }>(
        "SELECT enterprise_id FROM qassas_core.institution WHERE institution_id = $1 LIMIT 1",
        [institutionId],
      );
      if (!institution.rows[0]) throw new NotFoundException();

      const result = await client.query<{
        agreement_id: string;
        institution_id: string;
        agreement_type: string;
        agreement_status: string;
        document_ref: string;
        document_hash: string;
        allowed_domains: string[];
        effective_from: Date | null;
        effective_to: Date | null;
      }>(
        `INSERT INTO qassas_core.institution_access_agreement (
           agreement_id, institution_id, agreement_type, agreement_status,
           document_ref, document_hash, allowed_domains, effective_from,
           effective_to, approved_by_user_id
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         ON CONFLICT (agreement_id)
         DO UPDATE SET
           agreement_status = EXCLUDED.agreement_status,
           document_ref = EXCLUDED.document_ref,
           document_hash = EXCLUDED.document_hash,
           allowed_domains = EXCLUDED.allowed_domains,
           effective_from = EXCLUDED.effective_from,
           effective_to = EXCLUDED.effective_to,
           approved_by_user_id = EXCLUDED.approved_by_user_id,
           updated_at = now()
         RETURNING agreement_id, institution_id, agreement_type,
                   agreement_status, document_ref, document_hash,
                   allowed_domains, effective_from, effective_to`,
        [
          agreementId,
          institutionId,
          agreementType,
          agreementStatus,
          documentRef,
          documentHash,
          JSON.stringify(input.allowed_domains ?? []),
          effectiveFrom?.toISOString() ?? null,
          effectiveTo?.toISOString() ?? null,
          actor.userId,
        ],
      );

      await this.audit.write(client, {
        eventType: "INSTITUTION_ACCESS_AGREEMENT_RECORDED",
        objectType: "InstitutionAccessAgreement",
        objectId: agreementId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: "SYSTEM_ADMIN",
        tenantId: institution.rows[0].enterprise_id,
        correlationId,
        previousState: null,
        newState: agreementStatus,
        payload: {
          institution_id: institutionId,
          agreement_type: agreementType,
          document_ref: documentRef,
          document_hash: documentHash,
          allowed_domains: input.allowed_domains ?? [],
        },
      });

      const row = result.rows[0];
      return {
        ...row,
        effective_from: row.effective_from?.toISOString() ?? null,
        effective_to: row.effective_to?.toISOString() ?? null,
      };
    });
  }

  async activatePrivateSource(
    actor: AuthenticatedActor,
    portfolioId: string,
    sourceId: string,
    input: { agreement_id?: string },
    correlationId: string,
  ) {
    this.requireSystemAdmin(actor);
    const agreementId = input.agreement_id?.trim();
    if (!agreementId) {
      throw new BadRequestException("agreement_id is required");
    }

    return this.database.transaction(async (client) => {
      const context = await client.query<{
        institution_id: string;
        enterprise_id: string;
        source_class: string;
        agreement_status: string;
        effective_from: Date | null;
        effective_to: Date | null;
        allowed_domains: string[];
      }>(
        `SELECT
           p.institution_id,
           p.enterprise_id,
           r.source_class,
           a.agreement_status,
           a.effective_from,
           a.effective_to,
           a.allowed_domains
         FROM qassas_core.institution_portfolio p
         JOIN qassas_core.portfolio_data_source s
           ON s.portfolio_id = p.portfolio_id
         JOIN qassas_core.data_source_registry r
           ON r.source_id = s.source_id
         JOIN qassas_core.institution_access_agreement a
           ON a.agreement_id = $3
          AND a.institution_id = p.institution_id
        WHERE p.portfolio_id = $1
          AND s.source_id = $2
        LIMIT 1`,
        [portfolioId, sourceId, agreementId],
      );

      const row = context.rows[0];
      if (!row) throw new NotFoundException();
      if (row.source_class !== "PRIVATE_CONTRACTUAL") {
        throw new BadRequestException("Only private contractual sources use agreement activation");
      }

      const now = Date.now();
      const from = row.effective_from?.getTime() ?? Number.NaN;
      const to = row.effective_to?.getTime() ?? null;
      if (
        row.agreement_status !== "ACTIVE" ||
        !Number.isFinite(from) ||
        from > now ||
        (to !== null && to <= now)
      ) {
        throw new BadRequestException("Agreement is not currently active");
      }

      await client.query(
        `UPDATE qassas_core.portfolio_data_source
            SET access_status = 'CONNECTED',
                agreement_id = $3,
                allowed_domains = $4::jsonb
          WHERE portfolio_id = $1
            AND source_id = $2`,
        [portfolioId, sourceId, agreementId, JSON.stringify(row.allowed_domains ?? [])],
      );

      await client.query(
        `UPDATE qassas_core.source_adapter_contract
            SET adapter_status = 'CONNECTED',
                updated_at = now()
          WHERE source_id = $1
            AND adapter_kind = 'PARTNER_DATA_ROOM'`,
        [sourceId],
      );

      await this.audit.write(client, {
        eventType: "PRIVATE_DATA_SOURCE_ACTIVATED",
        objectType: "PortfolioDataSource",
        objectId: `${portfolioId}:${sourceId}`,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: "SYSTEM_ADMIN",
        tenantId: row.enterprise_id,
        correlationId,
        previousState: "TERM_SHEET_REQUIRED",
        newState: "CONNECTED",
        payload: {
          portfolio_id: portfolioId,
          source_id: sourceId,
          agreement_id: agreementId,
          allowed_domains: row.allowed_domains ?? [],
        },
      });

      return {
        portfolio_id: portfolioId,
        source_id: sourceId,
        agreement_id: agreementId,
        access_status: "CONNECTED",
        private_ingestion_enabled: true,
      };
    });
  }

  async bindPrimaryAdmin(
    actor: AuthenticatedActor,
    institutionId: string,
    input: { external_subject?: string },
    correlationId: string,
  ) {
    this.requireSystemAdmin(actor);
    const externalSubject = input.external_subject?.trim();

    if (!externalSubject || externalSubject.length < 8) {
      throw new BadRequestException(
        "external_subject from the verified Keycloak identity is required",
      );
    }

    return this.database.transaction(async (client) => {
      const context = await client.query<{
        enterprise_id: string;
        account_id: string;
        previous_user_id: string | null;
      }>(
        `SELECT i.enterprise_id,
                a.account_id,
                a.primary_admin_user_id AS previous_user_id
           FROM qassas_core.institution i
           JOIN qassas_security.institution_account a
             ON a.institution_id = i.institution_id
          WHERE i.institution_id = $1
          LIMIT 1`,
        [institutionId],
      );
      const contextRow = context.rows[0];
      if (!contextRow) throw new NotFoundException();

      const generatedUserId = `USR-${randomUUID()}`;
      const user = await client.query<{ user_id: string }>(
        `INSERT INTO qassas_security.user_identity (
           user_id, external_subject, status
         )
         VALUES ($1,$2,'ACTIVE')
         ON CONFLICT (external_subject)
         DO UPDATE SET status = 'ACTIVE'
         RETURNING user_id`,
        [generatedUserId, externalSubject],
      );
      const userId = user.rows[0].user_id;

      await client.query(
        `INSERT INTO qassas_security.institution_membership (
           membership_id, institution_id, user_id, institution_role,
           status, effective_from
         )
         VALUES ($1,$2,$3,'INSTITUTION_ADMIN','ACTIVE',now())
         ON CONFLICT (institution_id, user_id, institution_role)
         DO UPDATE SET
           status = 'ACTIVE',
           effective_from = LEAST(
             qassas_security.institution_membership.effective_from,
             now()
           ),
           effective_to = NULL`,
        [`MEM-${randomUUID()}`, institutionId, userId],
      );

      await client.query(
        `UPDATE qassas_security.institution_account
            SET external_subject = $2,
                primary_admin_user_id = $3,
                iam_binding_status = 'BOUND',
                status = 'ACTIVE',
                activated_at = COALESCE(activated_at, now()),
                updated_at = now()
          WHERE account_id = $1`,
        [contextRow.account_id, externalSubject, userId],
      );

      const eventType = contextRow.previous_user_id
        ? "PRIMARY_ADMIN_REBOUND"
        : "PRIMARY_ADMIN_BOUND";
      const payloadHash = createHash("sha256")
        .update(
          JSON.stringify({
            institution_id: institutionId,
            account_id: contextRow.account_id,
            user_id: userId,
            external_subject: externalSubject,
          }),
        )
        .digest("hex");

      await client.query(
        `INSERT INTO qassas_security.institution_identity_binding_event (
           binding_event_id, institution_id, account_id, user_id,
           external_subject, event_type, actor_user_id,
           correlation_id, payload_hash
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          `BIND-${randomUUID()}`,
          institutionId,
          contextRow.account_id,
          userId,
          externalSubject,
          eventType,
          actor.userId,
          correlationId,
          payloadHash,
        ],
      );

      await this.audit.write(client, {
        eventType,
        objectType: "InstitutionAccount",
        objectId: contextRow.account_id,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: "SYSTEM_ADMIN",
        tenantId: contextRow.enterprise_id,
        correlationId,
        previousState: contextRow.previous_user_id ? "BOUND" : "PENDING_IDP_LINK",
        newState: "BOUND",
        payload: {
          institution_id: institutionId,
          primary_admin_user_id: userId,
          external_subject_hash: createHash("sha256")
            .update(externalSubject)
            .digest("hex"),
        },
      });

      return {
        institution_id: institutionId,
        account_id: contextRow.account_id,
        primary_admin_user_id: userId,
        iam_binding_status: "BOUND",
        account_status: "ACTIVE",
        login_enabled: true,
      };
    });
  }

  private requireSystemAdmin(actor: AuthenticatedActor): void {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (role.roleType !== "SYSTEM_ADMIN" || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
    if (!allowed) throw new ForbiddenException("SYSTEM_ADMIN role required");
  }

  private async requireInstitutionVisibility(
    institutionId: string,
    actor: AuthenticatedActor,
  ): Promise<void> {
    try {
      this.requireSystemAdmin(actor);
      return;
    } catch {
      // Fall through to membership scope.
    }

    const result = await this.database.query(
      `SELECT 1
         FROM qassas_security.institution_membership
        WHERE institution_id = $1
          AND user_id = $2
          AND status = 'ACTIVE'
          AND effective_from <= now()
          AND (effective_to IS NULL OR effective_to > now())
        LIMIT 1`,
      [institutionId, actor.userId],
    );
    if (!result.rowCount) throw new NotFoundException();
  }
}
