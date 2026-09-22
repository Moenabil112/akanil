import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
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
import type {
  CapitalApprovalCommand,
  CapitalReleaseCommand,
  CapitalReturnCommand,
  CreateCapitalRequestCommand,
} from "./capital.types";

interface DecisionContextRow {
  decision_id: string;
  target_id: string;
  decision_class: string;
  state: string;
  object_version: string;
  evidence_snapshot_id: string | null;
  enterprise_id: string;
  asset_id: string | null;
}

interface CapitalRequestRow {
  capital_request_id: string;
  decision_id: string;
  capital_type: string;
  requested_amount: string;
  currency: string;
  purpose: string;
  funding_source: string | null;
  state: string;
  created_by_user_id: string;
  object_version: string;
  created_at: Date;
  updated_at: Date;
  target_id: string;
  decision_class: string;
  decision_state: string;
  evidence_snapshot_id: string | null;
  enterprise_id: string;
  asset_id: string | null;
}

interface ConstraintAssessmentRow {
  technical_state: string;
  licence_validation_status: string;
  partner_approval_required: boolean;
  partner_consent_status: string | null;
  licence_at_risk: boolean;
  execution_allowed: boolean;
}

interface RecommendationGateRow {
  recommendation_id: string;
  review_status: string | null;
}

interface CountRow {
  count: number;
}

interface RoleThresholdRow {
  role_assignment_id: string;
  capital_threshold: string | null;
}

interface ApprovalRow {
  approval_id: string;
  approved_amount: string;
  currency: string;
  approver_user_id: string;
  approver_role_assignment_id: string;
  rationale: string;
  created_at: Date;
}

interface GateAssessmentRow {
  assessment_id: string;
  evidence_gate: boolean;
  technical_gate: boolean;
  rights_gate: boolean;
  jv_gate: boolean;
  recommendation_gate: boolean;
  authority_gate: boolean;
  programme_readiness_gate: boolean;
  all_required_gates_pass: boolean;
  blocking_reasons: string[];
  created_at: Date;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class CapitalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async createRequest(
    actor: AuthenticatedActor,
    command: CreateCapitalRequestCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validateRequest(command);
    const context = await this.requireDecision(command.decision_id);
    if (!context.asset_id) throw new NotFoundException();

    await this.authorize(
      actor,
      "request",
      context,
      command.requested_amount,
      correlationId,
    );

    const requestHash = this.hash(command);
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreateCapitalRequest",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const requestId = `CAP-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.capital_request (
           capital_request_id, decision_id, capital_type, requested_amount,
           currency, purpose, funding_source, state, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'REQUESTED',$8)`,
        [
          requestId,
          command.decision_id,
          command.capital_type,
          command.requested_amount,
          command.currency,
          command.purpose,
          command.funding_source ?? null,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "CapitalRequested",
        objectType: "CapitalRequest",
        objectId: requestId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        previousState: null,
        newState: "REQUESTED",
        payload: {
          decision_id: command.decision_id,
          capital_type: command.capital_type,
          requested_amount: command.requested_amount,
          currency: command.currency,
          purpose: command.purpose,
        },
      });

      const result = {
        capital_request_id: requestId,
        decision_id: command.decision_id,
        capital_type: command.capital_type,
        requested_amount: command.requested_amount,
        currency: command.currency,
        state: "REQUESTED",
        object_version: 1,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "CreateCapitalRequest",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async assess(
    requestId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const request = await this.requireRequest(requestId);
    if (!request.asset_id) throw new NotFoundException();

    await this.authorize(
      actor,
      "assess",
      this.contextFromRequest(request),
      Number(request.requested_amount),
      correlationId,
    );

    const computed = await this.computeGates(request);
    const requestHash = this.hash({
      requestId,
      expectedVersion,
      computed,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "AssessCapitalRequest",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockRequest(client, requestId);
      this.ensureVersion(locked.object_version, expectedVersion);

      if (!["REQUESTED", "BLOCKED", "GATES_ASSESSED"].includes(locked.state)) {
        throw new ConflictException({ code: "QAS-CAPITAL-ASSESSMENT-STATE" });
      }

      const nextState = computed.allRequiredGatesPass
        ? "GATES_ASSESSED"
        : "BLOCKED";
      const nextVersion = Number(locked.object_version) + 1;

      await client.query(
        `UPDATE qassas_core.capital_request
            SET state = $2,
                object_version = $3,
                updated_at = now()
          WHERE capital_request_id = $1`,
        [requestId, nextState, nextVersion],
      );

      const assessmentId = `CGA-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.capital_gate_assessment (
           assessment_id, capital_request_id, request_object_version,
           evidence_gate, technical_gate, rights_gate, jv_gate,
           recommendation_gate, authority_gate, programme_readiness_gate,
           all_required_gates_pass, blocking_reasons, assessed_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          assessmentId,
          requestId,
          nextVersion,
          computed.evidenceGate,
          computed.technicalGate,
          computed.rightsGate,
          computed.jvGate,
          computed.recommendationGate,
          computed.authorityGate,
          computed.programmeReadinessGate,
          computed.allRequiredGatesPass,
          JSON.stringify(computed.blockingReasons),
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "CapitalGatesAssessed",
        objectType: "CapitalRequest",
        objectId: requestId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: request.enterprise_id,
        correlationId,
        previousState: locked.state,
        newState: nextState,
        payload: {
          assessment_id: assessmentId,
          ...computed,
        },
      });

      const result = {
        capital_request_id: requestId,
        assessment_id: assessmentId,
        state: nextState,
        object_version: nextVersion,
        ...computed,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "AssessCapitalRequest",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async approve(
    requestId: string,
    actor: AuthenticatedActor,
    command: CapitalApprovalCommand,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (!Number.isFinite(command.approved_amount) || command.approved_amount <= 0) {
      throw new BadRequestException("approved_amount must be positive");
    }
    this.requireText(command.rationale, "rationale");

    const request = await this.requireRequest(requestId);
    if (!request.asset_id) throw new NotFoundException();

    await this.authorize(
      actor,
      "approve",
      this.contextFromRequest(request),
      Number(request.requested_amount),
      correlationId,
    );

    const approverRole = this.financeAuthority(
      actor,
      request.asset_id,
      Number(request.requested_amount),
    );
    if (!approverRole) {
      throw new ForbiddenException({ code: "QAS-CAPITAL-AUTHORITY-EXCEEDED" });
    }

    if (command.approved_amount > Number(request.requested_amount)) {
      throw new BadRequestException(
        "approved_amount cannot exceed requested_amount",
      );
    }

    const requestHash = this.hash({
      requestId,
      expectedVersion,
      ...command,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "ApproveCapitalRequest",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockRequest(client, requestId);
      this.ensureVersion(locked.object_version, expectedVersion);
      if (locked.state !== "GATES_ASSESSED") {
        throw new ConflictException({
          code: "QAS-CAPITAL-GATES-NOT-PASSED",
          capital_state: locked.state,
        });
      }

      const latest = await this.latestAssessment(client, requestId);
      if (!latest?.all_required_gates_pass) {
        throw new ConflictException({
          code: "QAS-CAPITAL-GATES-NOT-PASSED",
        });
      }

      const approvalId = `CAPA-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.capital_approval (
           approval_id, capital_request_id, approved_amount, currency,
           approver_user_id, approver_role_assignment_id, rationale
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          approvalId,
          requestId,
          command.approved_amount,
          request.currency,
          actor.userId,
          approverRole.roleAssignmentId,
          command.rationale,
        ],
      );

      const nextVersion = Number(locked.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.capital_request
            SET state = 'APPROVED',
                object_version = $2,
                updated_at = now()
          WHERE capital_request_id = $1`,
        [requestId, nextVersion],
      );

      await this.events.write(client, {
        eventType: "CapitalApproved",
        objectType: "CapitalRequest",
        objectId: requestId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: approverRole.roleType,
        tenantId: request.enterprise_id,
        correlationId,
        previousState: locked.state,
        newState: "APPROVED",
        payload: {
          approval_id: approvalId,
          approved_amount: command.approved_amount,
          currency: request.currency,
          approver_role_assignment_id: approverRole.roleAssignmentId,
        },
      });

      const result = {
        capital_request_id: requestId,
        approval_id: approvalId,
        approved_amount: command.approved_amount,
        currency: request.currency,
        state: "APPROVED",
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "ApproveCapitalRequest",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async release(
    requestId: string,
    actor: AuthenticatedActor,
    command: CapitalReleaseCommand,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (!Number.isFinite(command.released_amount) || command.released_amount <= 0) {
      throw new BadRequestException("released_amount must be positive");
    }

    const request = await this.requireRequest(requestId);
    if (!request.asset_id) throw new NotFoundException();

    await this.authorize(
      actor,
      "release",
      this.contextFromRequest(request),
      Number(request.requested_amount),
      correlationId,
    );

    const approverRole = this.financeAuthority(
      actor,
      request.asset_id,
      Number(request.requested_amount),
    );
    if (!approverRole) {
      throw new ForbiddenException({ code: "QAS-CAPITAL-AUTHORITY-EXCEEDED" });
    }

    const revalidated = await this.computeGates(request);
    if (!revalidated.allRequiredGatesPass) {
      throw new ConflictException({
        code: "QAS-CAPITAL-RELEASE-BLOCKED",
        blocking_reasons: revalidated.blockingReasons,
      });
    }

    const requestHash = this.hash({
      requestId,
      expectedVersion,
      ...command,
      gate_signature: revalidated,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "ReleaseCapital",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockRequest(client, requestId);
      this.ensureVersion(locked.object_version, expectedVersion);
      if (locked.state !== "APPROVED") {
        throw new ConflictException({ code: "QAS-CAPITAL-NOT-APPROVED" });
      }

      const approval = await client.query<ApprovalRow>(
        `SELECT approval_id, approved_amount, currency, approver_user_id,
                approver_role_assignment_id, rationale, created_at
           FROM qassas_core.capital_approval
          WHERE capital_request_id = $1
          LIMIT 1`,
        [requestId],
      );
      const approvalRow = approval.rows[0];
      if (!approvalRow) {
        throw new ConflictException({ code: "QAS-CAPITAL-APPROVAL-MISSING" });
      }
      if (command.released_amount > Number(approvalRow.approved_amount)) {
        throw new BadRequestException(
          "released_amount cannot exceed approved_amount",
        );
      }

      const releaseId = `CAPR-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.capital_release (
           release_id, capital_request_id, approval_id, released_amount,
           currency, released_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          releaseId,
          requestId,
          approvalRow.approval_id,
          command.released_amount,
          request.currency,
          actor.userId,
        ],
      );

      const nextVersion = Number(locked.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.capital_request
            SET state = 'RELEASED',
                object_version = $2,
                updated_at = now()
          WHERE capital_request_id = $1`,
        [requestId, nextVersion],
      );

      await this.events.write(client, {
        eventType: "CapitalReleased",
        objectType: "CapitalRequest",
        objectId: requestId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: approverRole.roleType,
        tenantId: request.enterprise_id,
        correlationId,
        previousState: locked.state,
        newState: "RELEASED",
        payload: {
          release_id: releaseId,
          approval_id: approvalRow.approval_id,
          released_amount: command.released_amount,
          currency: request.currency,
        },
      });

      const result = {
        capital_request_id: requestId,
        release_id: releaseId,
        released_amount: command.released_amount,
        currency: request.currency,
        state: "RELEASED",
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "ReleaseCapital",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async returnCapital(
    requestId: string,
    actor: AuthenticatedActor,
    command: CapitalReturnCommand,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (!Number.isFinite(command.amount) || command.amount <= 0) {
      throw new BadRequestException("amount must be positive");
    }
    this.requireText(command.reason, "reason");

    const request = await this.requireRequest(requestId);
    if (!request.asset_id) throw new NotFoundException();

    await this.authorize(
      actor,
      "return",
      this.contextFromRequest(request),
      Number(request.requested_amount),
      correlationId,
    );

    const requestHash = this.hash({
      requestId,
      expectedVersion,
      ...command,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "ReturnCapital",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const locked = await this.lockRequest(client, requestId);
      this.ensureVersion(locked.object_version, expectedVersion);
      if (!["APPROVED", "RELEASED"].includes(locked.state)) {
        throw new ConflictException({ code: "QAS-CAPITAL-RETURN-STATE" });
      }

      const returnId = `CAPX-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.capital_return (
           return_id, capital_request_id, amount, currency, reason,
           recorded_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          returnId,
          requestId,
          command.amount,
          request.currency,
          command.reason,
          actor.userId,
        ],
      );

      const nextVersion = Number(locked.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.capital_request
            SET state = 'RETURNED',
                object_version = $2,
                updated_at = now()
          WHERE capital_request_id = $1`,
        [requestId, nextVersion],
      );

      await this.events.write(client, {
        eventType: "CapitalReturnedToPortfolio",
        objectType: "CapitalRequest",
        objectId: requestId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: request.enterprise_id,
        correlationId,
        previousState: locked.state,
        newState: "RETURNED",
        payload: {
          return_id: returnId,
          amount: command.amount,
          currency: request.currency,
          reason: command.reason,
        },
      });

      const result = {
        capital_request_id: requestId,
        return_id: returnId,
        amount: command.amount,
        currency: request.currency,
        state: "RETURNED",
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "ReturnCapital",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async getRequest(requestId: string, actor: AuthenticatedActor) {
    const request = await this.requireRequest(requestId);
    if (!request.asset_id) throw new NotFoundException();

    const read = await this.policy.canReadTarget(actor, {
      targetId: request.target_id,
      assetId: request.asset_id,
      securityClass: "C2_CONFIDENTIAL_TECHNICAL",
    });
    const finance = actor.roleAssignments.some(
      (role) =>
        role.roleType === "FINANCE_REVIEWER" &&
        role.assetScope.includes(request.asset_id!),
    );
    if (!read.allow && !finance) throw new NotFoundException();

    const [assessments, approvals] = await Promise.all([
      this.database.query<GateAssessmentRow>(
        `SELECT assessment_id, evidence_gate, technical_gate, rights_gate,
                jv_gate, recommendation_gate, authority_gate,
                programme_readiness_gate, all_required_gates_pass,
                blocking_reasons, created_at
           FROM qassas_core.capital_gate_assessment
          WHERE capital_request_id = $1
          ORDER BY created_at, assessment_id`,
        [requestId],
      ),
      this.database.query<ApprovalRow>(
        `SELECT approval_id, approved_amount, currency, approver_user_id,
                approver_role_assignment_id, rationale, created_at
           FROM qassas_core.capital_approval
          WHERE capital_request_id = $1`,
        [requestId],
      ),
    ]);

    return {
      capital_request_id: request.capital_request_id,
      decision_id: request.decision_id,
      capital_type: request.capital_type,
      requested_amount: Number(request.requested_amount),
      currency: request.currency,
      purpose: request.purpose,
      funding_source: request.funding_source,
      state: request.state,
      object_version: Number(request.object_version),
      gate_assessments: assessments.rows.map((row) => ({
        ...row,
        blocking_reasons: row.blocking_reasons,
        created_at: row.created_at.toISOString(),
      })),
      approval: approvals.rows[0]
        ? {
            ...approvals.rows[0],
            approved_amount: Number(approvals.rows[0].approved_amount),
            created_at: approvals.rows[0].created_at.toISOString(),
          }
        : null,
    };
  }

  private async computeGates(request: CapitalRequestRow) {
    const constraint = await this.database.query<ConstraintAssessmentRow>(
      `SELECT technical_state, licence_validation_status,
              partner_approval_required, partner_consent_status,
              licence_at_risk, execution_allowed
         FROM qassas_core.decision_constraint_assessment
        WHERE decision_id = $1
        ORDER BY created_at DESC, assessment_id DESC
        LIMIT 1`,
      [request.decision_id],
    );
    const rights = constraint.rows[0];

    const nbt = await this.database.query<CountRow>(
      `SELECT count(*)::int AS count
         FROM qassas_core.next_best_test
        WHERE decision_id = $1`,
      [request.decision_id],
    );

    const latestRecommendation = await this.database.query<RecommendationGateRow>(
      `SELECT r.recommendation_id, rr.review_status
         FROM qassas_core.recommendation r
         LEFT JOIN qassas_core.recommendation_review rr
           ON rr.recommendation_id = r.recommendation_id
        WHERE r.decision_id = $1
        ORDER BY r.recommendation_version DESC
        LIMIT 1`,
      [request.decision_id],
    );

    const authority = await this.database.query<RoleThresholdRow>(
      `SELECT role_assignment_id, capital_threshold
         FROM qassas_security.role_assignment
        WHERE role_type = 'FINANCE_REVIEWER'
          AND status = 'ACTIVE'
          AND effective_from <= now()
          AND (effective_to IS NULL OR effective_to > now())
          AND asset_scope ? $1
          AND (
            capital_threshold IS NULL OR
            capital_threshold >= $2
          )
        LIMIT 1`,
      [request.asset_id, Number(request.requested_amount)],
    );

    const evidenceGate = Boolean(request.evidence_snapshot_id);
    const technicalGate =
      request.capital_type === "DECISION_CAPITAL"
        ? Number(nbt.rows[0]?.count ?? 0) > 0
        : rights?.technical_state === "DECISION_READY";

    const rightsGate =
      rights?.licence_validation_status === "VALIDATED" &&
      rights?.licence_at_risk === false;

    const jvGate =
      Boolean(rights) &&
      rights.partner_approval_required === false &&
      ["APPROVED", "NOT_REQUIRED"].includes(
        rights.partner_consent_status ?? "NOT_REQUIRED",
      );

    const recommendationGate =
      request.capital_type === "DECISION_CAPITAL"
        ? true
        : latestRecommendation.rows[0]?.review_status === "ACCEPTED";

    const authorityGate = (authority.rowCount ?? 0) > 0;

    const programmeReadinessGate =
      request.capital_type === "DECISION_CAPITAL"
        ? evidenceGate && technicalGate && rightsGate && jvGate
        : rights?.execution_allowed === true && recommendationGate;

    const blockingReasons: string[] = [];
    if (!evidenceGate) blockingReasons.push("EVIDENCE_GATE_FAILED");
    if (!technicalGate) blockingReasons.push("TECHNICAL_GATE_FAILED");
    if (!rightsGate) blockingReasons.push("RIGHTS_GATE_FAILED");
    if (!jvGate) blockingReasons.push("JV_GATE_FAILED");
    if (!recommendationGate) {
      blockingReasons.push("RECOMMENDATION_GATE_FAILED");
    }
    if (!authorityGate) blockingReasons.push("AUTHORITY_GATE_FAILED");
    if (!programmeReadinessGate) {
      blockingReasons.push("PROGRAMME_READINESS_GATE_FAILED");
    }

    return {
      evidenceGate,
      technicalGate,
      rightsGate,
      jvGate,
      recommendationGate,
      authorityGate,
      programmeReadinessGate,
      allRequiredGatesPass: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  private async requireDecision(decisionId: string): Promise<DecisionContextRow> {
    const result = await this.database.query<DecisionContextRow>(
      `SELECT d.decision_id, d.target_id, d.decision_class, d.state,
              d.object_version, d.evidence_snapshot_id, t.enterprise_id,
              t.asset_id
         FROM qassas_core.decision_object d
         JOIN qassas_core.target t ON t.target_id = d.target_id
        WHERE d.decision_id = $1
        LIMIT 1`,
      [decisionId],
    );
    const row = result.rows[0];
    if (!row?.asset_id) throw new NotFoundException();
    return row;
  }

  private async requireRequest(requestId: string): Promise<CapitalRequestRow> {
    const result = await this.database.query<CapitalRequestRow>(
      this.requestSql(false),
      [requestId],
    );
    const row = result.rows[0];
    if (!row?.asset_id) throw new NotFoundException();
    return row;
  }

  private async lockRequest(
    client: PoolClient,
    requestId: string,
  ): Promise<CapitalRequestRow> {
    const result = await client.query<CapitalRequestRow>(
      this.requestSql(true),
      [requestId],
    );
    const row = result.rows[0];
    if (!row?.asset_id) throw new NotFoundException();
    return row;
  }

  private requestSql(forUpdate: boolean) {
    return `SELECT c.capital_request_id, c.decision_id, c.capital_type,
                   c.requested_amount, c.currency, c.purpose, c.funding_source,
                   c.state, c.created_by_user_id, c.object_version,
                   c.created_at, c.updated_at, d.target_id, d.decision_class,
                   d.state AS decision_state, d.evidence_snapshot_id,
                   t.enterprise_id, t.asset_id
              FROM qassas_core.capital_request c
              JOIN qassas_core.decision_object d
                ON d.decision_id = c.decision_id
              JOIN qassas_core.target t ON t.target_id = d.target_id
             WHERE c.capital_request_id = $1
             LIMIT 1
             ${forUpdate ? "FOR UPDATE OF c" : ""}`;
  }

  private contextFromRequest(request: CapitalRequestRow): DecisionContextRow {
    return {
      decision_id: request.decision_id,
      target_id: request.target_id,
      decision_class: request.decision_class,
      state: request.decision_state,
      object_version: "0",
      evidence_snapshot_id: request.evidence_snapshot_id,
      enterprise_id: request.enterprise_id,
      asset_id: request.asset_id,
    };
  }

  private async authorize(
    actor: AuthenticatedActor,
    action: "request" | "assess" | "approve" | "release" | "return",
    context: DecisionContextRow,
    amount: number,
    correlationId: string,
  ) {
    const allowed = await this.policy.canActOnCapital(actor, action, {
      assetId: context.asset_id!,
      requestedAmount: amount,
    });
    if (!allowed.allow) {
      await this.database.transaction((client) =>
        this.events.write(client, {
          eventType: "AccessDenied",
          objectType: "DecisionObject",
          objectId: context.decision_id,
          objectVersion: Number(context.object_version || 1),
          actorId: actor.userId,
          actorRole: this.actorRole(actor),
          tenantId: context.enterprise_id,
          correlationId,
          payload: {
            attempted_action: `capital_${action}`,
            reason: allowed.reason,
          },
        }),
      );
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }
  }

  private financeAuthority(
    actor: AuthenticatedActor,
    assetId: string,
    amount: number,
  ) {
    return actor.roleAssignments.find(
      (role) =>
        role.roleType === "FINANCE_REVIEWER" &&
        role.assetScope.includes(assetId) &&
        (role.capitalThreshold === null ||
          Number(role.capitalThreshold) >= amount),
    );
  }

  private async latestAssessment(client: PoolClient, requestId: string) {
    const result = await client.query<GateAssessmentRow>(
      `SELECT assessment_id, evidence_gate, technical_gate, rights_gate,
              jv_gate, recommendation_gate, authority_gate,
              programme_readiness_gate, all_required_gates_pass,
              blocking_reasons, created_at
         FROM qassas_core.capital_gate_assessment
        WHERE capital_request_id = $1
        ORDER BY created_at DESC, assessment_id DESC
        LIMIT 1`,
      [requestId],
    );
    return result.rows[0] ?? null;
  }

  private validateRequest(command: CreateCapitalRequestCommand) {
    this.requireText(command.decision_id, "decision_id");
    if (!["DECISION_CAPITAL", "EXECUTION_CAPITAL"].includes(command.capital_type)) {
      throw new BadRequestException("Invalid capital_type");
    }
    if (
      !Number.isFinite(command.requested_amount) ||
      command.requested_amount <= 0
    ) {
      throw new BadRequestException("requested_amount must be positive");
    }
    this.requireText(command.currency, "currency");
    this.requireText(command.purpose, "purpose");
  }

  private ensureVersion(current: string, expected: number) {
    const version = Number(current);
    if (version !== expected) {
      throw new ConflictException({
        code: "QAS-VERSION-CONFLICT",
        requested_version: expected,
        current_version: version,
      });
    }
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

  private requireText(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }
}
