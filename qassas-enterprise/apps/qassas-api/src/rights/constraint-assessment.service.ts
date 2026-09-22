import { createHash, randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { AuditEventWriter } from "../audit/audit-event.writer";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface DecisionRow {
  decision_id: string;
  target_id: string;
  decision_class: string;
  state: string;
  object_version: string;
  evidence_snapshot_id: string | null;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface LicenceRow {
  licence_id: string;
  licence_status: string;
  validation_status: string;
  expiry_date: Date | null;
}

interface ConstraintRow {
  constraint_id: string;
  jv_id: string;
  consent_required: boolean;
}

interface ConsentRow {
  consent_status: string;
  effective_until: Date | null;
}

interface CountRow {
  count: number;
}

interface CommitmentRiskRow {
  status: string;
  due_date: Date;
  days_to_due: number;
}

interface AssessmentRow {
  assessment_id: string;
  decision_id: string;
  licence_id: string;
  technical_state: string;
  derived_decision_state: string;
  licence_validation_status: string;
  partner_approval_required: boolean;
  partner_consent_status: string | null;
  work_commitment_risk: string | null;
  commitment_at_risk: boolean;
  licence_at_risk: boolean;
  execution_allowed: boolean;
  portfolio_optimisation_allowed: boolean;
  blocking_reasons: string[];
  created_by_user_id: string;
  created_at: Date;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class ConstraintAssessmentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async assess(
    decisionId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const context = await this.requireDecision(decisionId);
    if (!context.asset_id) throw new NotFoundException();

    const authz = await this.policy.canActOnRights(
      actor,
      "assess_constraints",
      {
        assetId: context.asset_id,
        jvId: null,
      },
    );
    if (!authz.allow) {
      await this.recordDenied(actor, context, correlationId, authz.reason);
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }

    if (Number(context.object_version) !== expectedVersion) {
      throw new ConflictException({
        code: "QAS-VERSION-CONFLICT",
        requested_version: expectedVersion,
        current_version: Number(context.object_version),
      });
    }

    const requestHash = this.hash({
      decisionId,
      expectedVersion,
    });

    const computed = await this.compute(context);

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "AssessDecisionConstraints",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockDecision(client, decisionId);
      if (Number(locked.object_version) !== expectedVersion) {
        throw new ConflictException({
          code: "QAS-VERSION-CONFLICT",
          requested_version: expectedVersion,
          current_version: Number(locked.object_version),
        });
      }

      let objectVersion = expectedVersion;
      if (locked.state !== computed.derivedDecisionState) {
        objectVersion += 1;
        await client.query(
          `UPDATE qassas_core.decision_object
              SET state = $2,
                  object_version = $3,
                  updated_at = now()
            WHERE decision_id = $1`,
          [decisionId, computed.derivedDecisionState, objectVersion],
        );
      }

      const assessmentId = `DCA-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.decision_constraint_assessment (
           assessment_id, decision_id, licence_id, technical_state,
           derived_decision_state, licence_validation_status,
           partner_approval_required, partner_consent_status,
           work_commitment_risk, commitment_at_risk, licence_at_risk,
           execution_allowed, portfolio_optimisation_allowed,
           blocking_reasons, created_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
         )`,
        [
          assessmentId,
          decisionId,
          context.asset_id,
          computed.technicalState,
          computed.derivedDecisionState,
          computed.licenceValidationStatus,
          computed.partnerApprovalRequired,
          computed.partnerConsentStatus,
          computed.workCommitmentRisk,
          computed.commitmentAtRisk,
          computed.licenceAtRisk,
          computed.executionAllowed,
          computed.portfolioOptimisationAllowed,
          JSON.stringify(computed.blockingReasons),
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "DecisionConstraintsAssessed",
        objectType: "DecisionObject",
        objectId: decisionId,
        objectVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        previousState: locked.state,
        newState: computed.derivedDecisionState,
        payload: {
          assessment_id: assessmentId,
          licence_id: context.asset_id,
          technical_state: computed.technicalState,
          partner_approval_required: computed.partnerApprovalRequired,
          partner_consent_status: computed.partnerConsentStatus,
          work_commitment_risk: computed.workCommitmentRisk,
          commitment_at_risk: computed.commitmentAtRisk,
          licence_at_risk: computed.licenceAtRisk,
          execution_allowed: computed.executionAllowed,
          portfolio_optimisation_allowed:
            computed.portfolioOptimisationAllowed,
          blocking_reasons: computed.blockingReasons,
        },
      });

      const result = {
        assessment_id: assessmentId,
        decision_id: decisionId,
        licence_id: context.asset_id,
        technical_state: computed.technicalState,
        state: computed.derivedDecisionState,
        licence_validation_status: computed.licenceValidationStatus,
        partner_approval_required: computed.partnerApprovalRequired,
        partner_consent_status: computed.partnerConsentStatus,
        work_commitment_risk: computed.workCommitmentRisk,
        commitment_at_risk: computed.commitmentAtRisk,
        licence_at_risk: computed.licenceAtRisk,
        execution_allowed: computed.executionAllowed,
        portfolio_optimisation_allowed:
          computed.portfolioOptimisationAllowed,
        blocking_reasons: computed.blockingReasons,
        object_version: objectVersion,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "AssessDecisionConstraints",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async latest(
    decisionId: string,
    actor: AuthenticatedActor,
  ) {
    const context = await this.requireDecision(decisionId);
    if (!context.asset_id) throw new NotFoundException();

    const authz = await this.policy.canActOnRights(actor, "read_rights", {
      assetId: context.asset_id,
      jvId: this.actorJVScope(actor, context.asset_id),
    });
    if (!authz.allow) throw new NotFoundException();

    const result = await this.database.query<AssessmentRow>(
      `SELECT assessment_id, decision_id, licence_id, technical_state,
              derived_decision_state, licence_validation_status,
              partner_approval_required, partner_consent_status,
              work_commitment_risk, commitment_at_risk, licence_at_risk,
              execution_allowed, portfolio_optimisation_allowed,
              blocking_reasons, created_by_user_id, created_at
         FROM qassas_core.decision_constraint_assessment
        WHERE decision_id = $1
        ORDER BY created_at DESC, assessment_id DESC
        LIMIT 1`,
      [decisionId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();

    return {
      assessment_id: row.assessment_id,
      decision_id: row.decision_id,
      licence_id: row.licence_id,
      technical_state: row.technical_state,
      state: row.derived_decision_state,
      licence_validation_status: row.licence_validation_status,
      partner_approval_required: row.partner_approval_required,
      partner_consent_status: row.partner_consent_status,
      work_commitment_risk: row.work_commitment_risk,
      commitment_at_risk: row.commitment_at_risk,
      licence_at_risk: row.licence_at_risk,
      execution_allowed: row.execution_allowed,
      portfolio_optimisation_allowed:
        row.portfolio_optimisation_allowed,
      blocking_reasons: row.blocking_reasons,
      created_by_user_id: row.created_by_user_id,
      created_at: row.created_at.toISOString(),
    };
  }

  private async compute(context: DecisionRow) {
    const licence = await this.database.query<LicenceRow>(
      `SELECT licence_id, licence_status, validation_status, expiry_date
         FROM qassas_core.licence_register
        WHERE licence_id = $1
        LIMIT 1`,
      [context.asset_id],
    );
    const licenceRow = licence.rows[0];
    if (!licenceRow) throw new NotFoundException();

    const conflicts = await this.database.query<CountRow>(
      `SELECT count(*)::int AS count
         FROM qassas_core.evidence_conflict
        WHERE target_id = $1
          AND severity IN ('CF-4','CF-5')
          AND status IN (
            'OPEN',
            'UNDER_REVIEW',
            'RESOLUTION_TEST_REQUIRED'
          )
          AND (decision_id IS NULL OR decision_id = $2)`,
      [context.target_id, context.decision_id],
    );

    const gaps = await this.database.query<CountRow>(
      `SELECT count(*)::int AS count
         FROM qassas_core.data_gap
        WHERE target_id = $1
          AND blocking_status = 'BLOCKING'
          AND status = 'OPEN'
          AND (decision_id IS NULL OR decision_id = $2)`,
      [context.target_id, context.decision_id],
    );

    const blockingConflictCount = Number(conflicts.rows[0]?.count ?? 0);
    const blockingGapCount = Number(gaps.rows[0]?.count ?? 0);

    const technicalState =
      blockingConflictCount > 0
        ? "CONFLICT_RESOLUTION_REQUIRED"
        : blockingGapCount > 0 || !context.evidence_snapshot_id
          ? "EVIDENCE_REQUIRED"
          : "DECISION_READY";

    const constraints = await this.database.query<ConstraintRow>(
      `SELECT constraint_id, jv_id, consent_required
         FROM qassas_core.jv_constraint
        WHERE licence_id = $1
          AND (
            decision_class IS NULL OR
            decision_class = $2
          )
        ORDER BY created_at, constraint_id`,
      [context.asset_id, context.decision_class],
    );

    const consentStatuses: string[] = [];
    let partnerApprovalRequired = false;

    for (const constraint of constraints.rows) {
      if (!constraint.consent_required) continue;

      const latest = await this.database.query<ConsentRow>(
        `SELECT consent_status, effective_until
           FROM qassas_core.jv_consent_event
          WHERE constraint_id = $1
          ORDER BY recorded_at DESC, consent_event_id DESC
          LIMIT 1`,
        [constraint.constraint_id],
      );

      const consent = latest.rows[0];
      let status = consent?.consent_status ?? "PENDING";
      if (
        status === "APPROVED" &&
        consent?.effective_until &&
        consent.effective_until.getTime() < Date.now()
      ) {
        status = "EXPIRED";
      }
      consentStatuses.push(status);
      if (status !== "APPROVED") {
        partnerApprovalRequired = true;
      }
    }

    const partnerConsentStatus =
      consentStatuses.length === 0
        ? "NOT_REQUIRED"
        : consentStatuses.every((status) => status === "APPROVED")
          ? "APPROVED"
          : [...new Set(consentStatuses)].length === 1
            ? consentStatuses[0]
            : "MIXED";

    const commitments = await this.database.query<CommitmentRiskRow>(
      `SELECT status, due_date,
              (due_date - CURRENT_DATE)::int AS days_to_due
         FROM qassas_core.work_commitment
        WHERE licence_id = $1
          AND mandatory = true
          AND status IN ('OPEN','OVERDUE')
        ORDER BY due_date`,
      [context.asset_id],
    );

    let workCommitmentRisk = "NONE";
    if (commitments.rows.some((row) => row.status === "OVERDUE" || row.days_to_due < 0)) {
      workCommitmentRisk = "WC-4_CRITICAL";
    } else if (commitments.rows.some((row) => row.days_to_due <= 30)) {
      workCommitmentRisk = "WC-3_30D";
    } else if (commitments.rows.some((row) => row.days_to_due <= 90)) {
      workCommitmentRisk = "WC-2_90D";
    } else if (commitments.rows.some((row) => row.days_to_due <= 180)) {
      workCommitmentRisk = "WC-1_180D";
    }

    const commitmentAtRisk = workCommitmentRisk !== "NONE";

    const expiryRisk =
      licenceRow.expiry_date !== null &&
      licenceRow.expiry_date.getTime() < Date.now();

    const licenceAtRisk =
      licenceRow.validation_status !== "VALIDATED" ||
      licenceRow.licence_status !== "ACTIVE" ||
      expiryRisk ||
      workCommitmentRisk === "WC-4_CRITICAL";

    const blockingReasons: string[] = [];
    if (licenceRow.validation_status !== "VALIDATED") {
      blockingReasons.push("LICENCE_STATUS_UNCONFIRMED");
    }
    if (licenceRow.licence_status !== "ACTIVE" || expiryRisk) {
      blockingReasons.push("LICENCE_AT_RISK");
    }
    if (partnerApprovalRequired) {
      blockingReasons.push("PARTNER_APPROVAL_REQUIRED");
    }
    if (commitmentAtRisk) {
      blockingReasons.push("COMMITMENT_AT_RISK");
    }
    if (technicalState !== "DECISION_READY") {
      blockingReasons.push(technicalState);
    }

    const derivedDecisionState = partnerApprovalRequired
      ? "PARTNER_APPROVAL_REQUIRED"
      : technicalState;

    const executionAllowed =
      technicalState === "DECISION_READY" &&
      licenceRow.validation_status === "VALIDATED" &&
      licenceRow.licence_status === "ACTIVE" &&
      !expiryRisk &&
      !partnerApprovalRequired;

    const portfolioOptimisationAllowed =
      executionAllowed && !commitmentAtRisk;

    return {
      technicalState,
      derivedDecisionState,
      licenceValidationStatus: licenceRow.validation_status,
      partnerApprovalRequired,
      partnerConsentStatus,
      workCommitmentRisk,
      commitmentAtRisk,
      licenceAtRisk,
      executionAllowed,
      portfolioOptimisationAllowed,
      blockingReasons,
    };
  }

  private async requireDecision(decisionId: string): Promise<DecisionRow> {
    const result = await this.database.query<DecisionRow>(
      `SELECT d.decision_id, d.target_id, d.decision_class, d.state,
              d.object_version, d.evidence_snapshot_id, t.enterprise_id,
              t.asset_id, t.security_class
         FROM qassas_core.decision_object d
         JOIN qassas_core.target t ON t.target_id = d.target_id
        WHERE d.decision_id = $1
        LIMIT 1`,
      [decisionId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async lockDecision(
    client: PoolClient,
    decisionId: string,
  ): Promise<DecisionRow> {
    const result = await client.query<DecisionRow>(
      `SELECT d.decision_id, d.target_id, d.decision_class, d.state,
              d.object_version, d.evidence_snapshot_id, t.enterprise_id,
              t.asset_id, t.security_class
         FROM qassas_core.decision_object d
         JOIN qassas_core.target t ON t.target_id = d.target_id
        WHERE d.decision_id = $1
        FOR UPDATE OF d`,
      [decisionId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private async recordDenied(
    actor: AuthenticatedActor,
    context: DecisionRow,
    correlationId: string,
    reason: string,
  ) {
    await this.database.transaction((client) =>
      this.events.write(client, {
        eventType: "AccessDenied",
        objectType: "DecisionObject",
        objectId: context.decision_id,
        objectVersion: Number(context.object_version),
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          attempted_action: "assess_constraints",
          reason,
        },
      }),
    );
  }

  private actorJVScope(actor: AuthenticatedActor, assetId: string) {
    const role = actor.roleAssignments.find(
      (item) =>
        item.roleType === "PARTNER_USER" &&
        item.assetScope.includes(assetId),
    );
    return role?.jvScope[0] ?? null;
  }

  private async idempotentResult(
    client: PoolClient,
    actorId: string,
    commandType: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, result_payload
         FROM qassas_core.command_idempotency
        WHERE actor_id = $1
          AND command_type = $2
          AND idempotency_key = $3`,
      [actorId, commandType, idempotencyKey],
    );
    const existing = result.rows[0];
    if (!existing) return null;
    if (existing.request_hash !== requestHash) {
      throw new ConflictException({ code: "QAS-IDEMPOTENCY-CONFLICT" });
    }
    return existing.result_payload;
  }

  private async storeIdempotency(
    client: PoolClient,
    actorId: string,
    commandType: string,
    idempotencyKey: string,
    requestHash: string,
    resultPayload: Record<string, unknown>,
  ) {
    await client.query(
      `INSERT INTO qassas_core.command_idempotency (
         actor_id, command_type, idempotency_key, request_hash, result_payload
       ) VALUES ($1,$2,$3,$4,$5)`,
      [actorId, commandType, idempotencyKey, requestHash, resultPayload],
    );
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }
}
