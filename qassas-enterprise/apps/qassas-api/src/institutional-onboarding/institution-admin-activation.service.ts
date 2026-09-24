import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { AuditEventWriter } from "../audit/audit-event.writer";
import type {
  AuthenticatedActor,
  VerifiedKeycloakIdentity,
} from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface TicketContextRow {
  ticket_id: string;
  institution_id: string;
  enterprise_id: string;
  display_name: string;
  account_id: string;
  account_status: string;
  iam_binding_status: string;
  expected_email: string;
  activation_secret_hash: string;
  ticket_status: string;
  created_at: Date;
  expires_at: Date;
  claimed_at: Date | null;
}

@Injectable()
export class InstitutionAdminActivationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditEventWriter,
  ) {}

  async createTicket(
    actor: AuthenticatedActor,
    institutionId: string,
    input: {
      expected_email?: string;
      expires_in_hours?: number;
    },
    correlationId: string,
  ) {
    this.requireSystemAdmin(actor);

    const expectedEmail = input.expected_email?.trim().toLowerCase();
    if (
      !expectedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedEmail)
    ) {
      throw new BadRequestException("A valid expected_email is required");
    }

    const hours = Number(input.expires_in_hours ?? 48);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new BadRequestException(
        "expires_in_hours must be an integer between 1 and 168",
      );
    }

    const activationCode = randomBytes(32).toString("base64url");
    const activationHash = this.hashSecret(activationCode);
    const ticketId = `IAT-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const result = await this.database.transaction(async (client) => {
      const context = await client.query<{
        enterprise_id: string;
        display_name: string;
        account_id: string;
        account_status: string;
        iam_binding_status: string;
      }>(
        `SELECT
           i.enterprise_id,
           i.display_name,
           a.account_id,
           a.status AS account_status,
           a.iam_binding_status
         FROM qassas_core.institution i
         JOIN qassas_security.institution_account a
           ON a.institution_id = i.institution_id
         WHERE i.institution_id = $1
         FOR UPDATE`,
        [institutionId],
      );

      const row = context.rows[0];
      if (!row) throw new NotFoundException();
      if (row.account_status === "ACTIVE" || row.iam_binding_status === "BOUND") {
        throw new BadRequestException(
          "Institutional account is already activated",
        );
      }

      await client.query(
        `UPDATE qassas_security.institution_admin_activation_ticket
            SET ticket_status = 'REVOKED',
                revoked_at = now()
          WHERE institution_id = $1
            AND ticket_status = 'PENDING'`,
        [institutionId],
      );

      await client.query(
        `INSERT INTO qassas_security.institution_admin_activation_ticket (
           ticket_id, institution_id, account_id, expected_email,
           activation_secret_hash, ticket_status, created_by_user_id,
           expires_at, correlation_id
         )
         VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8)`,
        [
          ticketId,
          institutionId,
          row.account_id,
          expectedEmail,
          activationHash,
          actor.userId,
          expiresAt.toISOString(),
          correlationId,
        ],
      );

      await this.audit.write(client, {
        eventType: "INSTITUTION_ADMIN_ACTIVATION_TICKET_ISSUED",
        objectType: "InstitutionAdminActivationTicket",
        objectId: ticketId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: "SYSTEM_ADMIN",
        tenantId: row.enterprise_id,
        correlationId,
        previousState: null,
        newState: "PENDING",
        payload: {
          institution_id: institutionId,
          account_id: row.account_id,
          expected_email_hash: createHash("sha256")
            .update(expectedEmail)
            .digest("hex"),
          expires_at: expiresAt.toISOString(),
        },
      });

      return {
        institution_id: institutionId,
        institution_name: row.display_name,
        account_id: row.account_id,
      };
    });

    return {
      ticket_id: ticketId,
      ...result,
      expected_email: expectedEmail,
      ticket_status: "PENDING",
      expires_at: expiresAt.toISOString(),
      activation_code: activationCode,
      activation_code_display_once: true,
    };
  }

  async latestTicket(
    actor: AuthenticatedActor,
    institutionId: string,
  ) {
    this.requireSystemAdmin(actor);

    const result = await this.database.query<{
      institution_id: string;
      enterprise_id: string;
      display_name: string;
      account_id: string;
      account_name: string;
      account_status: string;
      iam_binding_status: string;
      primary_admin_user_id: string | null;
      activated_at: Date | null;
      ticket_id: string | null;
      expected_email: string | null;
      ticket_status: string | null;
      ticket_created_at: Date | null;
      ticket_expires_at: Date | null;
      ticket_claimed_at: Date | null;
      login_enabled: boolean;
    }>(
      `SELECT *
         FROM qassas_security.institution_admin_activation_status
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
        status: row.account_status,
        iam_binding_status: row.iam_binding_status,
        primary_admin_user_id: row.primary_admin_user_id,
        activated_at: row.activated_at?.toISOString() ?? null,
        login_enabled: row.login_enabled,
      },
      latest_ticket: row.ticket_id
        ? {
            ticket_id: row.ticket_id,
            expected_email: row.expected_email,
            status: row.ticket_status,
            created_at: row.ticket_created_at?.toISOString() ?? null,
            expires_at: row.ticket_expires_at?.toISOString() ?? null,
            claimed_at: row.ticket_claimed_at?.toISOString() ?? null,
          }
        : null,
    };
  }

  async claimTicket(
    identity: VerifiedKeycloakIdentity,
    ticketId: string,
    activationCode: string | undefined,
    correlationId: string,
  ) {
    const secret = activationCode?.trim();
    if (!secret) {
      throw new BadRequestException("activation_code is required");
    }
    if (!identity.email || identity.emailVerified !== true) {
      throw new ForbiddenException(
        "A Keycloak identity with verified email is required",
      );
    }

    return this.database.transaction(async (client) => {
      const ticket = await this.ticketForUpdate(client, ticketId);
      if (!ticket) throw new NotFoundException();

      if (ticket.ticket_status !== "PENDING") {
        throw new BadRequestException(
          `Activation ticket is ${ticket.ticket_status.toLowerCase()}`,
        );
      }
      if (ticket.expires_at.getTime() <= Date.now()) {
        throw new BadRequestException("Activation ticket has expired");
      }
      if (ticket.account_status !== "PROVISIONED") {
        throw new BadRequestException(
          "Institutional account is not awaiting activation",
        );
      }
      if (ticket.iam_binding_status !== "PENDING_IDP_LINK") {
        throw new BadRequestException(
          "Institutional account identity is already bound",
        );
      }
      if (identity.email.toLowerCase() !== ticket.expected_email) {
        throw new ForbiddenException(
          "Verified Keycloak email does not match activation ticket",
        );
      }
      if (!this.secretsMatch(secret, ticket.activation_secret_hash)) {
        throw new ForbiddenException("Activation code is invalid");
      }

      const user = await client.query<{ user_id: string }>(
        `INSERT INTO qassas_security.user_identity (
           user_id, external_subject, status
         )
         VALUES ($1,$2,'ACTIVE')
         ON CONFLICT (external_subject)
         DO UPDATE SET status = 'ACTIVE'
         RETURNING user_id`,
        [`USR-${randomUUID()}`, identity.externalSubject],
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
        [`MEM-${randomUUID()}`, ticket.institution_id, userId],
      );

      await client.query(
        `INSERT INTO qassas_security.role_assignment (
           role_assignment_id, user_id, role_type, asset_scope, jv_scope,
           decision_class_scope, capital_threshold, security_clearance,
           effective_from, effective_to, status
         )
         SELECT
           $1,$2,'INSTITUTION_ADMIN','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
           NULL,'C2_CONFIDENTIAL_TECHNICAL',now(),NULL,'ACTIVE'
         WHERE NOT EXISTS (
           SELECT 1
             FROM qassas_security.role_assignment
            WHERE user_id = $2
              AND role_type = 'INSTITUTION_ADMIN'
              AND status = 'ACTIVE'
         )`,
        [`RA-INSTADMIN-${randomUUID()}`, userId],
      );

      await client.query(
        `UPDATE qassas_security.institution_account
            SET external_subject = $2,
                primary_admin_user_id = $3,
                iam_binding_status = 'BOUND',
                status = 'ACTIVE',
                activated_at = now(),
                updated_at = now()
          WHERE account_id = $1`,
        [ticket.account_id, identity.externalSubject, userId],
      );

      await client.query(
        `UPDATE qassas_security.institution_admin_activation_ticket
            SET ticket_status = 'CLAIMED',
                claimed_by_user_id = $2,
                claimed_at = now()
          WHERE ticket_id = $1`,
        [ticketId, userId],
      );

      const bindingPayload = {
        institution_id: ticket.institution_id,
        account_id: ticket.account_id,
        user_id: userId,
        external_subject: identity.externalSubject,
        verified_email: identity.email,
        ticket_id: ticketId,
      };
      const bindingHash = createHash("sha256")
        .update(JSON.stringify(bindingPayload))
        .digest("hex");

      await client.query(
        `INSERT INTO qassas_security.institution_identity_binding_event (
           binding_event_id, institution_id, account_id, user_id,
           external_subject, event_type, actor_user_id,
           correlation_id, payload_hash
         )
         VALUES ($1,$2,$3,$4,$5,'PRIMARY_ADMIN_BOUND',$4,$6,$7)`,
        [
          `BIND-${randomUUID()}`,
          ticket.institution_id,
          ticket.account_id,
          userId,
          identity.externalSubject,
          correlationId,
          bindingHash,
        ],
      );

      await this.audit.write(client, {
        eventType: "INSTITUTION_PRIMARY_ADMIN_SELF_ACTIVATED",
        objectType: "InstitutionAccount",
        objectId: ticket.account_id,
        objectVersion: 1,
        actorId: userId,
        actorRole: "INSTITUTION_ADMIN",
        tenantId: ticket.enterprise_id,
        correlationId,
        causationId: ticketId,
        previousState: "PROVISIONED/PENDING_IDP_LINK",
        newState: "ACTIVE/BOUND",
        payload: {
          institution_id: ticket.institution_id,
          ticket_id: ticketId,
          verified_email_hash: createHash("sha256")
            .update(identity.email)
            .digest("hex"),
          email_verified: true,
        },
      });

      return {
        institution_id: ticket.institution_id,
        institution_name: ticket.display_name,
        account_id: ticket.account_id,
        primary_admin_user_id: userId,
        iam_binding_status: "BOUND",
        account_status: "ACTIVE",
        login_enabled: true,
        ticket_status: "CLAIMED",
        next_action: "RELOAD_QASSAS_SESSION",
      };
    });
  }

  private async ticketForUpdate(
    client: PoolClient,
    ticketId: string,
  ): Promise<TicketContextRow | null> {
    const result = await client.query<TicketContextRow>(
      `SELECT
         t.ticket_id,
         t.institution_id,
         i.enterprise_id,
         i.display_name,
         t.account_id,
         a.status AS account_status,
         a.iam_binding_status,
         t.expected_email,
         t.activation_secret_hash,
         t.ticket_status,
         t.created_at,
         t.expires_at,
         t.claimed_at
       FROM qassas_security.institution_admin_activation_ticket t
       JOIN qassas_core.institution i
         ON i.institution_id = t.institution_id
       JOIN qassas_security.institution_account a
         ON a.account_id = t.account_id
       WHERE t.ticket_id = $1
       FOR UPDATE OF t, a`,
      [ticketId],
    );
    return result.rows[0] ?? null;
  }

  private requireSystemAdmin(actor: AuthenticatedActor): void {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (role.roleType !== "SYSTEM_ADMIN" || role.status !== "ACTIVE") {
        return false;
      }
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
    if (!allowed) throw new ForbiddenException("SYSTEM_ADMIN role required");
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private secretsMatch(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashSecret(secret), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }
}
