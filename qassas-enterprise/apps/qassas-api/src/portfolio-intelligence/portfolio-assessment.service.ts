import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditEventWriter } from "../audit/audit-event.writer";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface CreatePriorityAssessmentInput {
  asset_id: string;
  geological_potential: number;
  evidence_confidence: number;
  technical_maturity: number;
  scale_potential: number;
  strategic_adjacency: number;
  cost_efficiency: number;
  data_quality: number;
  work_commitment_risk: number;
  partner_constraint: number;
  next_decision_cost_sar: number;
  expected_information_gain_points: number;
  rationale: string;
}

interface ProfileRow {
  profile_id: string;
  enterprise_id: string;
  asset_id: string;
  primary_target_id: string;
  security_class: string;
  decision_id: string | null;
}

interface LatestAssessmentRow {
  assessment_id: string;
  assessment_version: number;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

@Injectable()
export class PortfolioAssessmentService {
  private readonly modelVersion = "PPI-0.1";

  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly audit: AuditEventWriter,
  ) {}

  async createAssessment(
    actor: AuthenticatedActor,
    input: CreatePriorityAssessmentInput,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requirePortfolioExecutive(actor);
    this.validate(input);

    const profileResult = await this.database.query<ProfileRow>(
      "SELECT p.profile_id, p.enterprise_id, p.asset_id, p.primary_target_id, p.security_class, q.decision_id FROM qassas_core.pilot_asset_profile p LEFT JOIN qassas_core.pilot_decision_queue q ON q.profile_id = p.profile_id WHERE p.asset_id = $1 AND p.pilot_status = 'ACTIVE' LIMIT 1",
      [input.asset_id],
    );
    const profile = profileResult.rows[0];
    if (!profile) throw new NotFoundException();

    const allowed = await this.policy.canReadTarget(actor, {
      targetId: profile.primary_target_id,
      assetId: profile.asset_id,
      securityClass: profile.security_class,
    });
    if (!allowed.allow) throw new ForbiddenException({ code: "QAS-AUTH-DENIED" });

    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const commandType = "CreatePortfolioPriorityAssessment";

    return this.database.transaction(async (client) => {
      const prior = await client.query<IdempotencyRow>(
        "SELECT request_hash, result_payload FROM qassas_core.command_idempotency WHERE actor_id = $1 AND command_type = $2 AND idempotency_key = $3",
        [actor.userId, commandType, idempotencyKey],
      );
      const existing = prior.rows[0];
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new ConflictException({ code: "QAS-IDEMPOTENCY-CONFLICT" });
        }
        return existing.result_payload;
      }

      await client.query(
        "SELECT profile_id FROM qassas_core.pilot_asset_profile WHERE profile_id = $1 FOR UPDATE",
        [profile.profile_id],
      );

      const latest = await client.query<LatestAssessmentRow>(
        "SELECT assessment_id, assessment_version FROM qassas_core.portfolio_priority_assessment WHERE profile_id = $1 ORDER BY assessment_version DESC LIMIT 1",
        [profile.profile_id],
      );
      const previous = latest.rows[0] ?? null;
      const nextVersion = (previous?.assessment_version ?? 0) + 1;
      const assessmentId = "PPA-" + randomUUID();

      const inserted = await client.query<{
        priority_index: string;
        voi_points_per_million_sar: string;
      }>(
        "INSERT INTO qassas_core.portfolio_priority_assessment (assessment_id, profile_id, decision_id, model_version, assessment_version, geological_potential, evidence_confidence, technical_maturity, scale_potential, strategic_adjacency, cost_efficiency, data_quality, work_commitment_risk, partner_constraint, next_decision_cost_sar, expected_information_gain_points, rationale, assessed_by_user_id, supersedes_assessment_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING priority_index, voi_points_per_million_sar",
        [
          assessmentId,
          profile.profile_id,
          profile.decision_id,
          this.modelVersion,
          nextVersion,
          input.geological_potential,
          input.evidence_confidence,
          input.technical_maturity,
          input.scale_potential,
          input.strategic_adjacency,
          input.cost_efficiency,
          input.data_quality,
          input.work_commitment_risk,
          input.partner_constraint,
          input.next_decision_cost_sar,
          input.expected_information_gain_points,
          input.rationale,
          actor.userId,
          previous?.assessment_id ?? null,
        ],
      );

      const metrics = inserted.rows[0];
      await this.audit.write(client, {
        eventType: "PortfolioPriorityAssessmentCreated",
        objectType: "PortfolioPriorityAssessment",
        objectId: assessmentId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: "PORTFOLIO_EXECUTIVE",
        tenantId: profile.enterprise_id,
        correlationId,
        previousState: previous?.assessment_id ?? null,
        newState: "ASSESSED",
        payload: {
          profile_id: profile.profile_id,
          asset_id: profile.asset_id,
          model_version: this.modelVersion,
          assessment_version: nextVersion,
          priority_index: Number(metrics.priority_index),
          voi_points_per_million_sar: Number(metrics.voi_points_per_million_sar),
          supersedes_assessment_id: previous?.assessment_id ?? null,
        },
      });

      const result = {
        assessment_id: assessmentId,
        profile_id: profile.profile_id,
        asset_id: profile.asset_id,
        model_version: this.modelVersion,
        assessment_version: nextVersion,
        supersedes_assessment_id: previous?.assessment_id ?? null,
        priority_index: Number(metrics.priority_index),
        voi_points_per_million_sar: Number(metrics.voi_points_per_million_sar),
        score_authority: "ADVISORY_ONLY",
        score_can_authorise_execution: false,
        score_can_release_capital: false,
        score_can_change_gate: false,
      };

      await client.query(
        "INSERT INTO qassas_core.command_idempotency (actor_id, command_type, idempotency_key, request_hash, result_payload) VALUES ($1,$2,$3,$4,$5)",
        [actor.userId, commandType, idempotencyKey, requestHash, result],
      );

      return result;
    });
  }

  private validate(input: CreatePriorityAssessmentInput) {
    const bounded = [
      ["geological_potential", input.geological_potential],
      ["evidence_confidence", input.evidence_confidence],
      ["technical_maturity", input.technical_maturity],
      ["scale_potential", input.scale_potential],
      ["strategic_adjacency", input.strategic_adjacency],
      ["cost_efficiency", input.cost_efficiency],
      ["data_quality", input.data_quality],
      ["work_commitment_risk", input.work_commitment_risk],
      ["partner_constraint", input.partner_constraint],
      ["expected_information_gain_points", input.expected_information_gain_points],
    ] as const;

    for (const [name, value] of bounded) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(name + " must be between 0 and 100");
      }
    }
    if (!Number.isFinite(input.next_decision_cost_sar) || input.next_decision_cost_sar <= 0) {
      throw new BadRequestException("next_decision_cost_sar must be positive");
    }
    if (!input.rationale?.trim()) {
      throw new BadRequestException("rationale is required");
    }
  }

  private requirePortfolioExecutive(actor: AuthenticatedActor) {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (role.roleType !== "PORTFOLIO_EXECUTIVE" || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
    if (!allowed) throw new NotFoundException();
  }
}
