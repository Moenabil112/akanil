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
  CreateCandidateActionCommand,
  IssueRecommendationCommand,
  ProposeNextBestTestCommand,
} from "./recommendation.types";

interface DecisionContextRow {
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

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

interface CandidateActionRow {
  candidate_action_id: string;
  decision_id: string;
  action_code: string;
  title: string;
  description: string;
  cost_class: string | null;
  technical_risk: string | null;
  partner_dependency: boolean;
  created_by_user_id: string;
  object_version: string;
  created_at: Date;
}

interface NextBestTestRow {
  test_id: string;
  decision_id: string;
  candidate_action_id: string | null;
  test_type: string;
  uncertainty_targeted: string;
  expected_information_gain: string;
  cost_class: string;
  cost_range_min: string | null;
  cost_range_max: string | null;
  time_range: string | null;
  dependencies: string[];
  technical_risk: string | null;
  decision_impact: string;
  required_authority: string;
  status: string;
  created_by_user_id: string;
  object_version: string;
  created_at: Date;
}

interface RecommendationRow {
  recommendation_id: string;
  decision_id: string;
  recommendation_version: number;
  evidence_snapshot_id: string;
  recommended_action_id: string;
  recommendation_text: string;
  rationale: string;
  confidence: string;
  recommender_type: string;
  model_version: string | null;
  supersedes_recommendation_id: string | null;
  created_by_user_id: string;
  created_at: Date;
}

interface RecommendationDeltaRow {
  delta_id: string;
  decision_id: string;
  previous_recommendation_id: string;
  new_recommendation_id: string;
  trigger_type: string;
  trigger_evidence_ids: string[];
  rationale: string;
  capital_impact: string | null;
  gate_impact: string | null;
  created_by_user_id: string;
  created_at: Date;
}

@Injectable()
export class RecommendationService {
  private readonly supportedDecisionStates = new Set([
    "EVIDENCE_REQUIRED",
    "CONFLICT_RESOLUTION_REQUIRED",
    "DECISION_READY",
  ]);

  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async getIntelligence(decisionId: string, actor: AuthenticatedActor) {
    const context = await this.requireContext(decisionId);
    await this.authorizeRead(actor, context);

    const [actions, tests, recommendations, deltas] = await Promise.all([
      this.database.query<CandidateActionRow>(
        `SELECT candidate_action_id, decision_id, action_code, title,
                description, cost_class, technical_risk, partner_dependency,
                created_by_user_id, object_version, created_at
           FROM qassas_core.candidate_action
          WHERE decision_id = $1
          ORDER BY created_at, candidate_action_id`,
        [decisionId],
      ),
      this.database.query<NextBestTestRow>(
        `SELECT test_id, decision_id, candidate_action_id, test_type,
                uncertainty_targeted, expected_information_gain, cost_class,
                cost_range_min, cost_range_max, time_range, dependencies,
                technical_risk, decision_impact, required_authority, status,
                created_by_user_id, object_version, created_at
           FROM qassas_core.next_best_test
          WHERE decision_id = $1
          ORDER BY created_at, test_id`,
        [decisionId],
      ),
      this.database.query<RecommendationRow>(
        `SELECT recommendation_id, decision_id, recommendation_version,
                evidence_snapshot_id, recommended_action_id,
                recommendation_text, rationale, confidence, recommender_type,
                model_version, supersedes_recommendation_id,
                created_by_user_id, created_at
           FROM qassas_core.recommendation
          WHERE decision_id = $1
          ORDER BY recommendation_version`,
        [decisionId],
      ),
      this.database.query<RecommendationDeltaRow>(
        `SELECT delta_id, decision_id, previous_recommendation_id,
                new_recommendation_id, trigger_type, trigger_evidence_ids,
                rationale, capital_impact, gate_impact, created_by_user_id,
                created_at
           FROM qassas_core.recommendation_delta
          WHERE decision_id = $1
          ORDER BY created_at, delta_id`,
        [decisionId],
      ),
    ]);

    const recommendationViews = recommendations.rows.map((row) =>
      this.recommendationView(row),
    );

    return {
      decision_id: decisionId,
      decision_state: context.state,
      decision_object_version: Number(context.object_version),
      evidence_snapshot_id: context.evidence_snapshot_id,
      candidate_actions: actions.rows.map((row) => ({
        candidate_action_id: row.candidate_action_id,
        action_code: row.action_code,
        title: row.title,
        description: row.description,
        cost_class: row.cost_class,
        technical_risk: row.technical_risk,
        partner_dependency: row.partner_dependency,
        created_by_user_id: row.created_by_user_id,
        object_version: Number(row.object_version),
        created_at: row.created_at.toISOString(),
      })),
      next_best_tests: tests.rows.map((row) => ({
        test_id: row.test_id,
        candidate_action_id: row.candidate_action_id,
        test_type: row.test_type,
        uncertainty_targeted: row.uncertainty_targeted,
        expected_information_gain: row.expected_information_gain,
        cost_class: row.cost_class,
        cost_range_min:
          row.cost_range_min === null ? null : Number(row.cost_range_min),
        cost_range_max:
          row.cost_range_max === null ? null : Number(row.cost_range_max),
        time_range: row.time_range,
        dependencies: row.dependencies,
        technical_risk: row.technical_risk,
        decision_impact: row.decision_impact,
        required_authority: row.required_authority,
        status: row.status,
        created_by_user_id: row.created_by_user_id,
        object_version: Number(row.object_version),
        created_at: row.created_at.toISOString(),
      })),
      recommendations: recommendationViews,
      current_recommendation:
        recommendationViews[recommendationViews.length - 1] ?? null,
      recommendation_deltas: deltas.rows.map((row) => ({
        delta_id: row.delta_id,
        previous_recommendation_id: row.previous_recommendation_id,
        new_recommendation_id: row.new_recommendation_id,
        trigger_type: row.trigger_type,
        trigger_evidence_ids: row.trigger_evidence_ids,
        rationale: row.rationale,
        capital_impact: row.capital_impact,
        gate_impact: row.gate_impact,
        created_by_user_id: row.created_by_user_id,
        created_at: row.created_at.toISOString(),
      })),
    };
  }

  async createCandidateAction(
    decisionId: string,
    actor: AuthenticatedActor,
    command: CreateCandidateActionCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireText(command.action_code, "action_code");
    this.requireText(command.title, "title");
    this.requireText(command.description, "description");
    if (
      command.cost_class &&
      !["C0", "C1", "C2", "C3", "C4", "C5"].includes(command.cost_class)
    ) {
      throw new BadRequestException("Invalid cost_class");
    }

    const context = await this.requireContext(decisionId);
    this.ensureSupportedDecisionState(context);
    await this.authorizeAction(actor, "create_action", context, correlationId);

    const requestHash = this.hash({ decisionId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreateCandidateAction",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const actionId = `ACT-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.candidate_action (
           candidate_action_id, decision_id, action_code, title, description,
           cost_class, technical_risk, partner_dependency, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          actionId,
          decisionId,
          command.action_code,
          command.title,
          command.description,
          command.cost_class ?? null,
          command.technical_risk ?? null,
          command.partner_dependency ?? false,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "CandidateActionCreated",
        objectType: "CandidateAction",
        objectId: actionId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          decision_id: decisionId,
          action_code: command.action_code,
          cost_class: command.cost_class ?? null,
          partner_dependency: command.partner_dependency ?? false,
        },
      });

      const result = {
        candidate_action_id: actionId,
        decision_id: decisionId,
        action_code: command.action_code,
        title: command.title,
        cost_class: command.cost_class ?? null,
        partner_dependency: command.partner_dependency ?? false,
        object_version: 1,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "CreateCandidateAction",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async proposeNextBestTest(
    decisionId: string,
    actor: AuthenticatedActor,
    command: ProposeNextBestTestCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validateNextBestTest(command);
    const context = await this.requireContext(decisionId);
    this.ensureSupportedDecisionState(context);
    await this.authorizeAction(actor, "propose_test", context, correlationId);

    if (command.candidate_action_id) {
      await this.requireCandidateAction(
        command.candidate_action_id,
        decisionId,
      );
    }

    const requestHash = this.hash({ decisionId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "ProposeNextBestTest",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const testId = `NBT-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.next_best_test (
           test_id, decision_id, candidate_action_id, test_type,
           uncertainty_targeted, expected_information_gain, cost_class,
           cost_range_min, cost_range_max, time_range, dependencies,
           technical_risk, decision_impact, required_authority, status,
           created_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PROPOSED',$15
         )`,
        [
          testId,
          decisionId,
          command.candidate_action_id ?? null,
          command.test_type,
          command.uncertainty_targeted,
          command.expected_information_gain,
          command.cost_class,
          command.cost_range_min ?? null,
          command.cost_range_max ?? null,
          command.time_range ?? null,
          command.dependencies ?? [],
          command.technical_risk ?? null,
          command.decision_impact,
          command.required_authority,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "NextBestTestProposed",
        objectType: "NextBestTest",
        objectId: testId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          decision_id: decisionId,
          candidate_action_id: command.candidate_action_id ?? null,
          test_type: command.test_type,
          uncertainty_targeted: command.uncertainty_targeted,
          expected_information_gain: command.expected_information_gain,
          cost_class: command.cost_class,
          decision_impact: command.decision_impact,
        },
      });

      const result = {
        test_id: testId,
        decision_id: decisionId,
        candidate_action_id: command.candidate_action_id ?? null,
        status: "PROPOSED",
        expected_information_gain: command.expected_information_gain,
        cost_class: command.cost_class,
        object_version: 1,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "ProposeNextBestTest",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  async issueRecommendation(
    decisionId: string,
    actor: AuthenticatedActor,
    command: IssueRecommendationCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.validateRecommendation(command);
    const context = await this.requireContext(decisionId);
    this.ensureSupportedDecisionState(context);
    if (!context.evidence_snapshot_id) {
      throw new ConflictException({
        code: "QAS-RECOMMENDATION-REQUIRES-EVIDENCE-SNAPSHOT",
      });
    }
    await this.authorizeAction(
      actor,
      "issue_recommendation",
      context,
      correlationId,
    );
    await this.requireCandidateAction(command.recommended_action_id, decisionId);

    const requestHash = this.hash({ decisionId, ...command });
    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "IssueRecommendation",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const latest = await client.query<RecommendationRow>(
        `SELECT recommendation_id, decision_id, recommendation_version,
                evidence_snapshot_id, recommended_action_id,
                recommendation_text, rationale, confidence, recommender_type,
                model_version, supersedes_recommendation_id,
                created_by_user_id, created_at
           FROM qassas_core.recommendation
          WHERE decision_id = $1
          ORDER BY recommendation_version DESC
          LIMIT 1`,
        [decisionId],
      );
      const previous = latest.rows[0];

      if (previous) {
        if (!command.supersedes_recommendation_id) {
          throw new ConflictException({
            code: "QAS-RECOMMENDATION-SUPERSEDES-REQUIRED",
            current_recommendation_id: previous.recommendation_id,
          });
        }
        if (
          command.supersedes_recommendation_id !== previous.recommendation_id
        ) {
          throw new ConflictException({
            code: "QAS-RECOMMENDATION-NOT-CURRENT",
            current_recommendation_id: previous.recommendation_id,
          });
        }
        if (!command.change_trigger) {
          throw new BadRequestException(
            "change_trigger is required when superseding a recommendation",
          );
        }
      } else if (command.supersedes_recommendation_id) {
        throw new BadRequestException(
          "Cannot supersede a recommendation when no previous recommendation exists",
        );
      }

      const recommendationId = `REC-${randomUUID()}`;
      const recommendationVersion = (previous?.recommendation_version ?? 0) + 1;

      await client.query(
        `INSERT INTO qassas_core.recommendation (
           recommendation_id, decision_id, recommendation_version,
           evidence_snapshot_id, recommended_action_id, recommendation_text,
           rationale, confidence, recommender_type, model_version,
           supersedes_recommendation_id, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'HUMAN',$9,$10,$11)`,
        [
          recommendationId,
          decisionId,
          recommendationVersion,
          context.evidence_snapshot_id,
          command.recommended_action_id,
          command.recommendation_text,
          command.rationale,
          command.confidence,
          command.model_version ?? null,
          command.supersedes_recommendation_id ?? null,
          actor.userId,
        ],
      );

      let deltaId: string | null = null;
      if (previous && command.change_trigger) {
        deltaId = `RDL-${randomUUID()}`;
        await client.query(
          `INSERT INTO qassas_core.recommendation_delta (
             delta_id, decision_id, previous_recommendation_id,
             new_recommendation_id, trigger_type, trigger_evidence_ids,
             rationale, capital_impact, gate_impact, created_by_user_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            deltaId,
            decisionId,
            previous.recommendation_id,
            recommendationId,
            command.change_trigger.trigger_type,
            command.change_trigger.trigger_evidence_ids ?? [],
            command.change_trigger.rationale,
            command.change_trigger.capital_impact ?? null,
            command.change_trigger.gate_impact ?? null,
            actor.userId,
          ],
        );
      }

      await this.events.write(client, {
        eventType: previous ? "RecommendationChanged" : "RecommendationIssued",
        objectType: "Recommendation",
        objectId: recommendationId,
        objectVersion: recommendationVersion,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: context.enterprise_id,
        correlationId,
        payload: {
          decision_id: decisionId,
          recommendation_version: recommendationVersion,
          evidence_snapshot_id: context.evidence_snapshot_id,
          recommended_action_id: command.recommended_action_id,
          confidence: command.confidence,
          supersedes_recommendation_id:
            command.supersedes_recommendation_id ?? null,
          delta_id: deltaId,
        },
      });

      const result = {
        recommendation_id: recommendationId,
        decision_id: decisionId,
        recommendation_version: recommendationVersion,
        evidence_snapshot_id: context.evidence_snapshot_id,
        recommended_action_id: command.recommended_action_id,
        confidence: command.confidence,
        supersedes_recommendation_id:
          command.supersedes_recommendation_id ?? null,
        delta_id: deltaId,
        decision_state: context.state,
        decision_object_version: Number(context.object_version),
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "IssueRecommendation",
        idempotencyKey,
        requestHash,
        result,
      );
      return result;
    });
  }

  private async requireContext(decisionId: string): Promise<DecisionContextRow> {
    const result = await this.database.query<DecisionContextRow>(
      `SELECT d.decision_id, d.target_id, d.decision_class, d.state,
              d.object_version, d.evidence_snapshot_id, t.enterprise_id,
              t.asset_id, t.security_class
         FROM qassas_core.decision_object d
         JOIN qassas_core.target t ON t.target_id = d.target_id
        WHERE d.decision_id = $1
        LIMIT 1`,
      [decisionId],
    );
    const context = result.rows[0];
    if (!context?.asset_id) throw new NotFoundException();
    return context;
  }

  private async requireCandidateAction(actionId: string, decisionId: string) {
    const result = await this.database.query<{ candidate_action_id: string }>(
      `SELECT candidate_action_id
         FROM qassas_core.candidate_action
        WHERE candidate_action_id = $1
          AND decision_id = $2
        LIMIT 1`,
      [actionId, decisionId],
    );
    if (!result.rowCount) {
      throw new BadRequestException(
        "candidate_action_id must belong to the DecisionObject",
      );
    }
  }

  private ensureSupportedDecisionState(context: DecisionContextRow) {
    if (!this.supportedDecisionStates.has(context.state)) {
      throw new ConflictException({
        code: "QAS-DECISION-INTELLIGENCE-STATE-NOT-SUPPORTED",
        decision_state: context.state,
      });
    }
  }

  private async authorizeRead(
    actor: AuthenticatedActor,
    context: DecisionContextRow,
  ) {
    const allowed = await this.policy.canReadTarget(actor, {
      targetId: context.target_id,
      assetId: context.asset_id!,
      securityClass: context.security_class,
    });
    if (!allowed.allow) throw new NotFoundException();
  }

  private async authorizeAction(
    actor: AuthenticatedActor,
    action: "create_action" | "propose_test" | "issue_recommendation",
    context: DecisionContextRow,
    correlationId: string,
  ) {
    const allowed = await this.policy.canActOnRecommendation(actor, action, {
      decisionId: context.decision_id,
      targetId: context.target_id,
      assetId: context.asset_id!,
      decisionClass: context.decision_class,
    });
    if (!allowed.allow) {
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
            attempted_action: action,
            reason: allowed.reason,
          },
        }),
      );
      throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });
    }
  }

  private validateNextBestTest(command: ProposeNextBestTestCommand) {
    this.requireText(command.test_type, "test_type");
    this.requireText(command.uncertainty_targeted, "uncertainty_targeted");
    this.requireText(command.decision_impact, "decision_impact");
    this.requireText(command.required_authority, "required_authority");
    if (
      !["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(
        command.expected_information_gain,
      )
    ) {
      throw new BadRequestException("Invalid expected_information_gain");
    }
    if (!["C0", "C1", "C2", "C3", "C4", "C5"].includes(command.cost_class)) {
      throw new BadRequestException("Invalid cost_class");
    }
    if (
      command.cost_range_min !== undefined &&
      command.cost_range_min !== null &&
      command.cost_range_min < 0
    ) {
      throw new BadRequestException("cost_range_min cannot be negative");
    }
    if (
      command.cost_range_max !== undefined &&
      command.cost_range_max !== null &&
      command.cost_range_max < 0
    ) {
      throw new BadRequestException("cost_range_max cannot be negative");
    }
    if (
      command.cost_range_min != null &&
      command.cost_range_max != null &&
      command.cost_range_max < command.cost_range_min
    ) {
      throw new BadRequestException(
        "cost_range_max cannot be lower than cost_range_min",
      );
    }
  }

  private validateRecommendation(command: IssueRecommendationCommand) {
    this.requireText(command.recommended_action_id, "recommended_action_id");
    this.requireText(command.recommendation_text, "recommendation_text");
    this.requireText(command.rationale, "rationale");
    if (!["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(command.confidence)) {
      throw new BadRequestException("Invalid confidence");
    }
    if (command.change_trigger) {
      this.requireText(command.change_trigger.trigger_type, "trigger_type");
      this.requireText(command.change_trigger.rationale, "change_trigger.rationale");
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

  private recommendationView(row: RecommendationRow) {
    return {
      recommendation_id: row.recommendation_id,
      recommendation_version: row.recommendation_version,
      evidence_snapshot_id: row.evidence_snapshot_id,
      recommended_action_id: row.recommended_action_id,
      recommendation_text: row.recommendation_text,
      rationale: row.rationale,
      confidence: row.confidence,
      recommender_type: row.recommender_type,
      model_version: row.model_version,
      supersedes_recommendation_id: row.supersedes_recommendation_id,
      created_by_user_id: row.created_by_user_id,
      created_at: row.created_at.toISOString(),
    };
  }
}
