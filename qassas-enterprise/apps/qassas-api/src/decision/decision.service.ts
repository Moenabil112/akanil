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
import { TemporalWorkflowService } from "../temporal/temporal-workflow.service";

export interface OpenDecisionCommand {
  target_id: string;
  decision_class: string;
  decision_question: string;
  trigger_type: string;
  current_gate: string;
}

interface DecisionContextRow {
  decision_id: string;
  target_id: string;
  decision_class: string;
  decision_question: string;
  current_gate: string;
  trigger_type: string;
  state: string;
  decision_version: string;
  object_version: string;
  evidence_snapshot_id: string | null;
  final_decision: string | null;
  final_rationale: string | null;
  created_by_user_id: string | null;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface TargetScopeRow {
  target_id: string;
  enterprise_id: string;
  asset_id: string | null;
  current_gate: string;
  security_class: string;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

interface ReviewRow {
  review_id: string;
  required_role: string;
  workflow_id: string | null;
}

interface ReviewWorkflowStateRow {
  workflow_id: string | null;
  workflow_started_at: Date | null;
  workflow_signal_sent_at: Date | null;
  reviewer_role_assignment_id: string | null;
}

interface SnapshotBindingRow {
  snapshot_id: string;
  target_id: string;
  snapshot_status: string;
}

interface CountRow {
  count: number;
}

@Injectable()
export class DecisionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
    private readonly temporal: TemporalWorkflowService,
  ) {}

  async getDecision(decisionId: string, actor: AuthenticatedActor) {
    const context = await this.loadContext(decisionId);
    if (!context?.asset_id) {
      throw new NotFoundException();
    }

    const access = await this.policy.canReadTarget(actor, {
      targetId: context.target_id,
      assetId: context.asset_id,
      securityClass: context.security_class,
    });
    if (!access.allow) {
      throw new NotFoundException();
    }

    return this.toView(context);
  }

  async openDecision(
    actor: AuthenticatedActor,
    command: OpenDecisionCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireFields(command);

    const target = await this.database.query<TargetScopeRow>(
      `SELECT target_id, enterprise_id, asset_id, current_gate, security_class
         FROM qassas_core.target
        WHERE target_id = $1
        LIMIT 1`,
      [command.target_id],
    );
    const scope = target.rows[0];
    if (!scope?.asset_id) {
      throw new NotFoundException();
    }

    const authz = await this.policy.canActOnDecision(actor, "open", {
      targetId: scope.target_id,
      assetId: scope.asset_id,
      decisionClass: command.decision_class,
      createdByUserId: actor.userId,
    });
    if (!authz.allow) {
      await this.recordDenied(
        actor,
        scope.enterprise_id,
        "Target",
        scope.target_id,
        1,
        correlationId,
        authz.reason,
        "open_decision",
      );
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }

    const requestHash = this.hash(command);
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "OpenDecision",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const decisionId = `DEC-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.decision_object (
           decision_id, target_id, decision_class, decision_question,
           current_gate, trigger_type, state, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,'CREATED',$7)`,
        [
          decisionId,
          command.target_id,
          command.decision_class,
          command.decision_question,
          command.current_gate,
          command.trigger_type,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "DecisionOpened",
        objectType: "DecisionObject",
        objectId: decisionId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: scope.enterprise_id,
        correlationId,
        previousState: null,
        newState: "CREATED",
        payload: {
          target_id: command.target_id,
          decision_class: command.decision_class,
          decision_question: command.decision_question,
          trigger_type: command.trigger_type,
          current_gate: command.current_gate,
        },
      });

      const result = {
        decision_id: decisionId,
        target_id: command.target_id,
        decision_class: command.decision_class,
        decision_question: command.decision_question,
        current_gate: command.current_gate,
        trigger_type: command.trigger_type,
        state: "CREATED",
        decision_version: 1,
        object_version: 1,
        created_by_user_id: actor.userId,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "OpenDecision",
        idempotencyKey,
        requestHash,
        result,
      );

      return result;
    });
  }

  async bindEvidenceSnapshot(
    decisionId: string,
    actor: AuthenticatedActor,
    snapshotId: string,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (!snapshotId?.trim()) {
      throw new BadRequestException("snapshot_id is required");
    }

    const context = await this.requireDecisionContext(decisionId);
    await this.authorizeDecisionAction(
      actor,
      "bind_evidence",
      context,
      correlationId,
    );

    const requestHash = this.hash({
      decisionId,
      snapshotId,
      expectedVersion,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "BindEvidenceSnapshot",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const current = await this.lockContext(client, decisionId);
      this.ensureVersion(current, expectedVersion);

      if (
        ![
          "CREATED",
          "EVIDENCE_REQUESTED",
          "EVIDENCE_RECEIVED",
          "EVIDENCE_ASSESSMENT",
          "EVIDENCE_REQUIRED",
          "CONFLICT_RESOLUTION_REQUIRED",
          "DECISION_READY",
        ].includes(current.state)
      ) {
        throw new ConflictException({
          code: "QAS-INVALID-STATE-TRANSITION",
        });
      }

      const snapshot = await client.query<SnapshotBindingRow>(
        `SELECT snapshot_id, target_id, snapshot_status
           FROM qassas_core.evidence_snapshot
          WHERE snapshot_id = $1
            AND target_id = $2
          LIMIT 1`,
        [snapshotId, current.target_id],
      );
      const snapshotRow = snapshot.rows[0];
      if (!snapshotRow) {
        throw new BadRequestException(
          "snapshot_id must reference a snapshot for the same target",
        );
      }
      if (snapshotRow.snapshot_status !== "LOCKED") {
        throw new ConflictException({
          code: "QAS-EVIDENCE-SNAPSHOT-NOT-LOCKED",
        });
      }

      const blockingConflicts = await client.query<CountRow>(
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
        [current.target_id, decisionId],
      );

      const blockingGaps = await client.query<CountRow>(
        `SELECT count(*)::int AS count
           FROM qassas_core.data_gap
          WHERE target_id = $1
            AND blocking_status = 'BLOCKING'
            AND status = 'OPEN'
            AND (decision_id IS NULL OR decision_id = $2)`,
        [current.target_id, decisionId],
      );

      const conflictCount = Number(blockingConflicts.rows[0]?.count ?? 0);
      const gapCount = Number(blockingGaps.rows[0]?.count ?? 0);

      const derivedState =
        conflictCount > 0
          ? "CONFLICT_RESOLUTION_REQUIRED"
          : gapCount > 0
            ? "EVIDENCE_REQUIRED"
            : "DECISION_READY";

      const nextVersion = Number(current.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.decision_object
            SET evidence_snapshot_id = $2,
                state = $3,
                object_version = $4,
                updated_at = now()
          WHERE decision_id = $1`,
        [decisionId, snapshotId, derivedState, nextVersion],
      );

      const bindingId = `DEB-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.decision_evidence_binding (
           binding_id, decision_id, snapshot_id, decision_object_version,
           bound_by_user_id, derived_state, blocking_gap_count,
           blocking_conflict_count
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          bindingId,
          decisionId,
          snapshotId,
          nextVersion,
          actor.userId,
          derivedState,
          gapCount,
          conflictCount,
        ],
      );

      await this.events.write(client, {
        eventType: "DecisionEvidenceBound",
        objectType: "DecisionObject",
        objectId: decisionId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: current.enterprise_id,
        correlationId,
        previousState: current.state,
        newState: derivedState,
        payload: {
          binding_id: bindingId,
          snapshot_id: snapshotId,
          blocking_gap_count: gapCount,
          blocking_conflict_count: conflictCount,
        },
      });

      const result = {
        decision_id: decisionId,
        binding_id: bindingId,
        evidence_snapshot_id: snapshotId,
        state: derivedState,
        blocking_gap_count: gapCount,
        blocking_conflict_count: conflictCount,
        object_version: nextVersion,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "BindEvidenceSnapshot",
        idempotencyKey,
        requestHash,
        result,
      );

      return result;
    });
  }

  async requestHumanReview(
    decisionId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const context = await this.requireDecisionContext(decisionId);
    await this.authorizeDecisionAction(
      actor,
      "request_review",
      context,
      correlationId,
    );

    const requestHash = this.hash({ decisionId, expectedVersion });
    const result = await this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "RequestHumanReview",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const current = await this.lockContext(client, decisionId);
      this.ensureVersion(current, expectedVersion);
      if (!["CREATED", "DECISION_READY"].includes(current.state)) {
        throw new ConflictException({ code: "QAS-INVALID-STATE-TRANSITION" });
      }

      const reviewId = `REV-${randomUUID()}`;
      const workflowId = this.temporal.workflowId(decisionId, reviewId);

      await client.query(
        `INSERT INTO qassas_core.human_review (
           review_id, decision_id, required_role, review_status, workflow_id
         ) VALUES ($1,$2,'EXPLORATION_DIRECTOR','PENDING',$3)`,
        [reviewId, decisionId, workflowId],
      );

      const nextVersion = Number(current.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.decision_object
            SET state = 'HUMAN_REVIEW_REQUIRED',
                object_version = $2,
                updated_at = now()
          WHERE decision_id = $1`,
        [decisionId, nextVersion],
      );

      await this.events.write(client, {
        eventType: "HumanReviewRequested",
        objectType: "DecisionObject",
        objectId: decisionId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: current.enterprise_id,
        correlationId,
        previousState: current.state,
        newState: "HUMAN_REVIEW_REQUIRED",
        payload: {
          review_id: reviewId,
          required_role: "EXPLORATION_DIRECTOR",
          workflow_id: workflowId,
        },
      });

      const resultPayload = {
        decision_id: decisionId,
        review_id: reviewId,
        workflow_id: workflowId,
        state: "HUMAN_REVIEW_REQUIRED",
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        "RequestHumanReview",
        idempotencyKey,
        requestHash,
        resultPayload,
      );
      return resultPayload;
    });

    await this.ensureWorkflowStarted(decisionId, result);
    return result;
  }

  approveDecision(
    decisionId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    rationale: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.finaliseDecision(
      "approve",
      decisionId,
      actor,
      expectedVersion,
      rationale,
      idempotencyKey,
      correlationId,
    );
  }

  rejectDecision(
    decisionId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    rationale: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return this.finaliseDecision(
      "reject",
      decisionId,
      actor,
      expectedVersion,
      rationale,
      idempotencyKey,
      correlationId,
    );
  }

  private async finaliseDecision(
    action: "approve" | "reject",
    decisionId: string,
    actor: AuthenticatedActor,
    expectedVersion: number,
    rationale: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    if (!rationale?.trim()) {
      throw new BadRequestException("Rationale is required");
    }

    const context = await this.requireDecisionContext(decisionId);
    await this.authorizeDecisionAction(actor, action, context, correlationId);

    const commandType = action === "approve" ? "ApproveDecision" : "RejectDecision";
    const finalState = action === "approve" ? "APPROVED" : "REJECTED";
    const eventType = action === "approve" ? "DecisionApproved" : "DecisionRejected";
    const requestHash = this.hash({ decisionId, expectedVersion, rationale });

    const result = await this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        commandType,
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const current = await this.lockContext(client, decisionId);
      this.ensureVersion(current, expectedVersion);
      if (current.state !== "HUMAN_REVIEW_REQUIRED") {
        throw new ConflictException({ code: "QAS-INVALID-STATE-TRANSITION" });
      }

      const review = await client.query<ReviewRow>(
        `SELECT review_id, required_role, workflow_id
           FROM qassas_core.human_review
          WHERE decision_id = $1
            AND review_status = 'PENDING'
          ORDER BY started_at DESC
          LIMIT 1
          FOR UPDATE`,
        [decisionId],
      );
      const pending = review.rows[0];
      if (!pending) {
        throw new ConflictException({ code: "QAS-HUMAN-REVIEW-NOT-PENDING" });
      }
      if (!pending.workflow_id) {
        throw new ConflictException({ code: "QAS-WORKFLOW-NOT-BOUND" });
      }

      const reviewerRole = actor.roleAssignments.find(
        (role) =>
          role.roleType === pending.required_role &&
          role.assetScope.includes(current.asset_id ?? "") &&
          role.decisionClassScope.includes(current.decision_class),
      );
      if (!reviewerRole) {
        throw new ForbiddenException({ code: "QAS-AUTHORITY-INSUFFICIENT" });
      }

      await client.query(
        `UPDATE qassas_core.human_review
            SET reviewer_user_id = $2,
                reviewer_role_assignment_id = $3,
                review_status = 'COMPLETED',
                review_decision = $4,
                rationale = $5,
                completed_at = now(),
                object_version = object_version + 1
          WHERE review_id = $1`,
        [
          pending.review_id,
          actor.userId,
          reviewerRole.roleAssignmentId,
          finalState,
          rationale,
        ],
      );

      const nextVersion = Number(current.object_version) + 1;
      await client.query(
        `UPDATE qassas_core.decision_object
            SET state = $2,
                final_decision = $2,
                final_rationale = $3,
                object_version = $4,
                updated_at = now()
          WHERE decision_id = $1`,
        [decisionId, finalState, rationale, nextVersion],
      );

      await this.events.write(client, {
        eventType,
        objectType: "DecisionObject",
        objectId: decisionId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: reviewerRole.roleType,
        tenantId: current.enterprise_id,
        correlationId,
        previousState: current.state,
        newState: finalState,
        payload: {
          review_id: pending.review_id,
          workflow_id: pending.workflow_id,
          rationale,
        },
      });

      const resultPayload = {
        decision_id: decisionId,
        review_id: pending.review_id,
        workflow_id: pending.workflow_id,
        reviewer_role_assignment_id: reviewerRole.roleAssignmentId,
        state: finalState,
        final_decision: finalState,
        final_rationale: rationale,
        object_version: nextVersion,
      };
      await this.storeIdempotency(
        client,
        actor.userId,
        commandType,
        idempotencyKey,
        requestHash,
        resultPayload,
      );
      return resultPayload;
    });

    await this.ensureWorkflowSignaled(
      action,
      actor,
      expectedVersion,
      rationale,
      result,
    );
    return result;
  }

  private async ensureWorkflowStarted(
    decisionId: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    const reviewId = String(result.review_id ?? "");
    const workflowId = String(result.workflow_id ?? "");
    if (!reviewId || !workflowId) {
      throw new ConflictException({ code: "QAS-WORKFLOW-BINDING-MISSING" });
    }

    const state = await this.database.query<ReviewWorkflowStateRow>(
      `SELECT workflow_id, workflow_started_at, workflow_signal_sent_at,
              reviewer_role_assignment_id
         FROM qassas_core.human_review
        WHERE review_id = $1
        LIMIT 1`,
      [reviewId],
    );

    if (state.rows[0]?.workflow_started_at) {
      return;
    }

    await this.temporal.ensureReviewWorkflowStarted(
      workflowId,
      decisionId,
      reviewId,
    );

    await this.database.query(
      `UPDATE qassas_core.human_review
          SET workflow_started_at = COALESCE(workflow_started_at, now())
        WHERE review_id = $1`,
      [reviewId],
    );
  }

  private async ensureWorkflowSignaled(
    action: "approve" | "reject",
    actor: AuthenticatedActor,
    expectedVersion: number,
    rationale: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    const reviewId = String(result.review_id ?? "");
    if (!reviewId) {
      throw new ConflictException({ code: "QAS-WORKFLOW-BINDING-MISSING" });
    }

    const state = await this.database.query<ReviewWorkflowStateRow>(
      `SELECT workflow_id, workflow_started_at, workflow_signal_sent_at,
              reviewer_role_assignment_id
         FROM qassas_core.human_review
        WHERE review_id = $1
        LIMIT 1`,
      [reviewId],
    );

    const row = state.rows[0];
    if (!row?.workflow_id || !row.reviewer_role_assignment_id) {
      throw new ConflictException({ code: "QAS-WORKFLOW-BINDING-MISSING" });
    }
    if (row.workflow_signal_sent_at) {
      return;
    }

    await this.temporal.signalReview(row.workflow_id, action, {
      reviewerUserId: actor.userId,
      roleAssignmentId: row.reviewer_role_assignment_id,
      expectedDecisionVersion: expectedVersion,
      rationale,
    });

    await this.database.query(
      `UPDATE qassas_core.human_review
          SET workflow_signal_sent_at = COALESCE(workflow_signal_sent_at, now())
        WHERE review_id = $1`,
      [reviewId],
    );
  }

  private async authorizeDecisionAction(
    actor: AuthenticatedActor,
    action: "bind_evidence" | "request_review" | "approve" | "reject",
    context: DecisionContextRow,
    correlationId: string,
  ) {
    if (!context.asset_id) {
      throw new NotFoundException();
    }

    const authz = await this.policy.canActOnDecision(actor, action, {
      decisionId: context.decision_id,
      targetId: context.target_id,
      assetId: context.asset_id,
      decisionClass: context.decision_class,
      createdByUserId: context.created_by_user_id,
    });

    if (!authz.allow) {
      await this.recordDenied(
        actor,
        context.enterprise_id,
        "DecisionObject",
        context.decision_id,
        Number(context.object_version),
        correlationId,
        authz.reason,
        action,
      );
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }
  }

  private async recordDenied(
    actor: AuthenticatedActor,
    tenantId: string,
    objectType: string,
    objectId: string,
    objectVersion: number,
    correlationId: string,
    reason: string,
    attemptedAction: string,
  ) {
    await this.database.transaction((client) =>
      this.events.write(client, {
        eventType: "AccessDenied",
        objectType,
        objectId,
        objectVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId,
        correlationId,
        payload: {
          attempted_action: attemptedAction,
          reason,
        },
      }),
    );
  }

  private async requireDecisionContext(decisionId: string) {
    const context = await this.loadContext(decisionId);
    if (!context) throw new NotFoundException();
    return context;
  }

  private async loadContext(decisionId: string): Promise<DecisionContextRow | null> {
    const result = await this.database.query<DecisionContextRow>(
      this.contextSql(false),
      [decisionId],
    );
    return result.rows[0] ?? null;
  }

  private async lockContext(
    client: PoolClient,
    decisionId: string,
  ): Promise<DecisionContextRow> {
    const result = await client.query<DecisionContextRow>(
      this.contextSql(true),
      [decisionId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return row;
  }

  private contextSql(forUpdate: boolean) {
    return `SELECT d.decision_id, d.target_id, d.decision_class,
                   d.decision_question, d.current_gate, d.trigger_type,
                   d.state, d.decision_version, d.object_version,
                   d.evidence_snapshot_id, d.final_decision, d.final_rationale,
                   d.created_by_user_id, t.enterprise_id, t.asset_id,
                   t.security_class
              FROM qassas_core.decision_object d
              JOIN qassas_core.target t ON t.target_id = d.target_id
             WHERE d.decision_id = $1
             LIMIT 1
             ${forUpdate ? "FOR UPDATE OF d" : ""}`;
  }

  private ensureVersion(context: DecisionContextRow, expectedVersion: number) {
    const currentVersion = Number(context.object_version);
    if (currentVersion !== expectedVersion) {
      throw new ConflictException({
        code: "QAS-VERSION-CONFLICT",
        requested_version: expectedVersion,
        current_version: currentVersion,
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
    return createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
  }

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }

  private requireFields(command: OpenDecisionCommand) {
    for (const [key, value] of Object.entries(command)) {
      if (typeof value !== "string" || !value.trim()) {
        throw new BadRequestException(`${key} is required`);
      }
    }
  }

  private toView(context: DecisionContextRow) {
    return {
      decision_id: context.decision_id,
      target_id: context.target_id,
      decision_class: context.decision_class,
      decision_question: context.decision_question,
      current_gate: context.current_gate,
      trigger_type: context.trigger_type,
      state: context.state,
      decision_version: Number(context.decision_version),
      object_version: Number(context.object_version),
      evidence_snapshot_id: context.evidence_snapshot_id,
      final_decision: context.final_decision,
      final_rationale: context.final_rationale,
      created_by_user_id: context.created_by_user_id,
    };
  }
}
