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
import type { ReviewRecommendationCommand } from "./recommendation-review.types";

interface ContextRow {
  recommendation_id: string;
  recommendation_version: number;
  recommendation_created_by_user_id: string;
  decision_id: string;
  decision_state: string;
  decision_object_version: string;
  decision_class: string;
  target_id: string;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface ReviewRow {
  review_id: string;
  recommendation_id: string;
  decision_id: string;
  review_status: string;
  reviewer_user_id: string;
  reviewer_role_assignment_id: string;
  rationale: string;
  created_at: Date;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class RecommendationReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async getReview(
    decisionId: string,
    recommendationId: string,
    actor: AuthenticatedActor,
  ) {
    const context = await this.requireContext(decisionId, recommendationId);
    await this.authorizeRead(actor, context);

    const review = await this.database.query<ReviewRow>(
      `SELECT review_id, recommendation_id, decision_id, review_status,
              reviewer_user_id, reviewer_role_assignment_id,
              rationale, created_at
         FROM qassas_core.recommendation_review
        WHERE recommendation_id = $1
        LIMIT 1`,
      [recommendationId],
    );

    const row = review.rows[0];
    if (!row) throw new NotFoundException();

    return {
      review_id: row.review_id,
      recommendation_id: row.recommendation_id,
      decision_id: row.decision_id,
      review_status: row.review_status,
      reviewer_user_id: row.reviewer_user_id,
      reviewer_role_assignment_id: row.reviewer_role_assignment_id,
      rationale: row.rationale,
      created_at: row.created_at.toISOString(),
      decision_state: context.decision_state,
      decision_object_version: Number(context.decision_object_version),
      execution_authorised: false,
      capital_release_authorised: false,
    };
  }

  async reviewRecommendation(
    decisionId: string,
    recommendationId: string,
    actor: AuthenticatedActor,
    command: ReviewRecommendationCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validate(command);
    const context = await this.requireContext(decisionId, recommendationId);
    await this.ensureCurrentRecommendation(context);

    const allowed = await this.policy.canActOnRecommendation(
      actor,
      "review_recommendation",
      {
        decisionId: context.decision_id,
        targetId: context.target_id,
        assetId: context.asset_id!,
        decisionClass: context.decision_class,
        recommendationCreatedByUserId:
          context.recommendation_created_by_user_id,
      },
    );

    if (!allowed.allow) {
      await this.recordDenied(actor, context, correlationId, allowed.reason);
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }

    const reviewerRole = actor.roleAssignments.find(
      (role) =>
        role.roleType === "EXPLORATION_DIRECTOR" &&
        role.assetScope.includes(context.asset_id ?? "") &&
        role.decisionClassScope.includes(context.decision_class),
    );
    if (!reviewerRole) {
      throw new ForbiddenException({ code: "QAS-AUTHORITY-INSUFFICIENT" });
    }

    const requestHash = this.hash({
      decisionId,
      recommendationId,
      ...command,
    });

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "ReviewRecommendation",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const already = await client.query<{ review_id: string }>(
        `SELECT review_id
           FROM qassas_core.recommendation_review
          WHERE recommendation_id = $1
          LIMIT 1`,
        [recommendationId],
      );
      if (already.rowCount) {
        throw new ConflictException({
          code: "QAS-RECOMMENDATION-ALREADY-REVIEWED",
          review_id: already.rows[0]?.review_id,
        });
      }

      const reviewId = `RRV-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.recommendation_review (
           review_id, recommendation_id, decision_id, review_status,
           reviewer_user_id, reviewer_role_assignment_id, rationale
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          reviewId,
          recommendationId,
          decisionId,
          command.review_status,
          actor.userId,
          reviewerRole.roleAssignmentId,
          command.rationale,
        ],
      );

      const eventType =
        command.review_status === "ACCEPTED"
          ? "RecommendationAccepted"
          : "RecommendationRejected";

      await this.events.write(client, {
        eventType,
        objectType: "Recommendation",
        objectId: recommendationId,
        objectVersion: context.recommendation_version,
        actorId: actor.userId,
        actorRole: reviewerRole.roleType,
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          review_id: reviewId,
          decision_id: decisionId,
          review_status: command.review_status,
          rationale: command.rationale,
          decision_state_unchanged: context.decision_state,
          execution_authorised: false,
          capital_release_authorised: false,
        },
      });

      const result = {
        review_id: reviewId,
        recommendation_id: recommendationId,
        decision_id: decisionId,
        review_status: command.review_status,
        reviewer_role_assignment_id: reviewerRole.roleAssignmentId,
        decision_state: context.decision_state,
        decision_object_version: Number(context.decision_object_version),
        execution_authorised: false,
        capital_release_authorised: false,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "ReviewRecommendation",
        idempotencyKey,
        requestHash,
        result,
      );

      return result;
    });
  }

  private async requireContext(
    decisionId: string,
    recommendationId: string,
  ): Promise<ContextRow> {
    const result = await this.database.query<ContextRow>(
      `SELECT r.recommendation_id, r.recommendation_version,
              r.created_by_user_id AS recommendation_created_by_user_id,
              d.decision_id, d.state AS decision_state,
              d.object_version AS decision_object_version,
              d.decision_class, d.target_id,
              t.enterprise_id, t.asset_id, t.security_class
         FROM qassas_core.recommendation r
         JOIN qassas_core.decision_object d
           ON d.decision_id = r.decision_id
         JOIN qassas_core.target t
           ON t.target_id = d.target_id
        WHERE r.recommendation_id = $1
          AND r.decision_id = $2
        LIMIT 1`,
      [recommendationId, decisionId],
    );

    const context = result.rows[0];
    if (!context?.asset_id) throw new NotFoundException();
    return context;
  }

  private async ensureCurrentRecommendation(context: ContextRow) {
    const current = await this.database.query<{
      recommendation_id: string;
      recommendation_version: number;
    }>(
      `SELECT recommendation_id, recommendation_version
         FROM qassas_core.recommendation
        WHERE decision_id = $1
        ORDER BY recommendation_version DESC
        LIMIT 1`,
      [context.decision_id],
    );

    const latest = current.rows[0];
    if (!latest || latest.recommendation_id !== context.recommendation_id) {
      throw new ConflictException({
        code: "QAS-RECOMMENDATION-NOT-CURRENT",
        current_recommendation_id: latest?.recommendation_id ?? null,
      });
    }
  }

  private async authorizeRead(
    actor: AuthenticatedActor,
    context: ContextRow,
  ) {
    const allowed = await this.policy.canReadTarget(actor, {
      targetId: context.target_id,
      assetId: context.asset_id!,
      securityClass: context.security_class,
    });
    if (!allowed.allow) throw new NotFoundException();
  }

  private async recordDenied(
    actor: AuthenticatedActor,
    context: ContextRow,
    correlationId: string,
    reason: string,
  ) {
    await this.database.transaction((client) =>
      this.events.write(client, {
        eventType: "AccessDenied",
        objectType: "Recommendation",
        objectId: context.recommendation_id,
        objectVersion: context.recommendation_version,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          attempted_action: "review_recommendation",
          reason,
        },
      }),
    );
  }

  private validate(command: ReviewRecommendationCommand) {
    if (!["ACCEPTED", "REJECTED"].includes(command.review_status)) {
      throw new BadRequestException(
        "review_status must be ACCEPTED or REJECTED",
      );
    }
    if (!command.rationale?.trim()) {
      throw new BadRequestException("rationale is required");
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

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }
}
