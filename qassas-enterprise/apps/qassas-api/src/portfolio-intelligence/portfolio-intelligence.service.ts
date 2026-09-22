import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { AuditEventWriter } from "../audit/audit-event.writer";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import type {
  CreateScenarioCommand,
  CreateTargetAssessmentCommand,
  PortfolioIntelligenceRow,
  PortfolioScoreWeights,
  TargetAssessmentDimensions,
} from "./portfolio-intelligence.types";

interface ScoringModelRow {
  model_code: string;
  model_version: number;
  w_geological_potential: string;
  w_evidence_confidence: string;
  w_technical_maturity: string;
  w_scale_potential: string;
  w_strategic_adjacency: string;
  w_cost_to_next_decision: string;
  w_work_commitment_risk: string;
  w_partner_constraint: string;
  w_data_quality: string;
}

interface TargetContextRow {
  target_id: string;
  enterprise_id: string;
  asset_id: string | null;
  security_class: string;
}

interface AssessmentRow {
  assessment_id: string;
  assessment_version: number;
  target_id: string;
  decision_id: string | null;
  geological_potential: string;
  evidence_confidence: string;
  technical_maturity: string;
  scale_potential: string;
  strategic_adjacency: string;
  cost_to_next_decision_score: string;
  work_commitment_risk_score: string;
  partner_constraint_score: string;
  data_quality: string;
  cost_to_next_decision_sar: string;
  expected_information_gain: string;
}

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

interface ReassessmentRow {
  reassessment_id: string;
  target_id: string;
  decision_id: string | null;
  recommendation_delta_id: string | null;
  previous_assessment_id: string;
  new_assessment_id: string;
  previous_ppi: string;
  new_ppi: string;
  ppi_delta: string;
  previous_voi_points_per_million_sar: string;
  new_voi_points_per_million_sar: string;
  voi_delta: string;
  trigger_type: string;
  rationale: string;
  created_at: Date;
}

@Injectable()
export class PortfolioIntelligenceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
    private readonly events: AuditEventWriter,
  ) {}

  async controlBoard(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    const visible = await this.visibleRows(actor);
    const ranked = visible.filter(
      (row) => row.portfolio_priority_index !== null,
    );

    return {
      interface: "CONTROL_BOARD",
      scoring_model: ranked[0]
        ? {
            model_code: ranked[0].model_code,
            model_version: Number(ranked[0].model_version),
          }
        : null,
      policy: {
        ranking_is_advisory: true,
        score_authorises_execution: false,
        blockers_dominate_execution: true,
      },
      visible_asset_count: visible.length,
      ranked_asset_count: ranked.length,
      blocked_asset_count: visible.filter((row) =>
        row.governance_state.startsWith("BLOCKED_"),
      ).length,
      assets: visible.map((row) => this.boardAssetView(row)),
    };
  }

  async boardView(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE"]);
    const visible = await this.visibleRows(actor);

    return {
      interface: "BOARD",
      visible_asset_count: visible.length,
      policy: {
        ranking_is_advisory: true,
        score_authorises_execution: false,
      },
      assets: visible.map((row) => ({
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        decision_state: row.decision_state,
        ppi:
          row.portfolio_priority_index === null
            ? null
            : Number(row.portfolio_priority_index),
        priority_rank:
          row.priority_rank === null ? null : Number(row.priority_rank),
        voi_points_per_million_sar:
          row.voi_points_per_million_sar === null
            ? null
            : Number(row.voi_points_per_million_sar),
        governance_state: row.governance_state,
        capital_state: row.capital_state,
        next_controlled_action: this.nextControlledAction(row),
      })),
    };
  }

  async explorationView(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["EXPLORATION_DIRECTOR"]);
    const visible = await this.visibleRows(actor);

    return {
      interface: "EXPLORATION",
      visible_asset_count: visible.length,
      assets: visible.map((row) => this.boardAssetView(row)),
    };
  }

  async financeView(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["FINANCE_REVIEWER"]);
    const visible = await this.visibleRows(actor);

    return {
      interface: "FINANCE_INTELLIGENCE",
      visible_asset_count: visible.length,
      assets: visible.map((row) => ({
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        decision_id: row.decision_id,
        decision_state: row.decision_state,
        portfolio_priority_index:
          row.portfolio_priority_index === null
            ? null
            : Number(row.portfolio_priority_index),
        priority_rank:
          row.priority_rank === null ? null : Number(row.priority_rank),
        cost_to_next_decision_sar:
          row.cost_to_next_decision_sar === null
            ? null
            : Number(row.cost_to_next_decision_sar),
        voi_points_per_million_sar:
          row.voi_points_per_million_sar === null
            ? null
            : Number(row.voi_points_per_million_sar),
        governance_state: row.governance_state,
        partner_approval_required: row.partner_approval_required,
        commitment_at_risk: row.commitment_at_risk,
        licence_at_risk: row.licence_at_risk,
        capital_state: row.capital_state,
        released_capital_total: Number(row.released_capital_total ?? 0),
        score_authorises_execution: false,
      })),
    };
  }

  async getAsset(assetId: string, actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);

    const result = await this.database.query<PortfolioIntelligenceRow>(
      `SELECT *
         FROM qassas_core.portfolio_intelligence_read_model
        WHERE asset_id = $1
        LIMIT 1`,
      [assetId],
    );

    const row = result.rows[0];
    if (!row) throw new NotFoundException();

    const allowed = await this.canRead(actor, row);
    if (!allowed) throw new NotFoundException();

    return this.boardAssetView(row);
  }

  async createAssessment(
    actor: AuthenticatedActor,
    command: CreateTargetAssessmentCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireAnyRole(actor, ["EXPLORATION_DIRECTOR"]);
    this.validateAssessmentCommand(command);

    const target = await this.targetContext(command.target_id);
    if (!target?.asset_id) throw new NotFoundException();
    await this.authorizeTarget(actor, target);

    if (command.decision_id) {
      const decision = await this.database.query<{ decision_id: string }>(
        `SELECT decision_id
           FROM qassas_core.decision_object
          WHERE decision_id = $1
            AND target_id = $2
          LIMIT 1`,
        [command.decision_id, command.target_id],
      );
      if (!decision.rowCount) {
        throw new ConflictException({
          code: "QAS-ASSESSMENT-DECISION-TARGET-MISMATCH",
        });
      }
    }

    if (command.recommendation_delta_id) {
      if (!command.decision_id) {
        throw new BadRequestException(
          "decision_id is required when recommendation_delta_id is supplied",
        );
      }
      const delta = await this.database.query<{ delta_id: string }>(
        `SELECT delta_id
           FROM qassas_core.recommendation_delta
          WHERE delta_id = $1
            AND decision_id = $2
          LIMIT 1`,
        [command.recommendation_delta_id, command.decision_id],
      );
      if (!delta.rowCount) {
        throw new ConflictException({
          code: "QAS-REASSESSMENT-DELTA-MISMATCH",
        });
      }
    }

    const model = await this.activeModel();
    const weights = this.weightsFromModel(model);
    const requestHash = this.hash(command);

    const result = await this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreateTargetAssessment",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      await client.query(
        "SELECT target_id FROM qassas_core.target WHERE target_id = $1 FOR UPDATE",
        [command.target_id],
      );

      const previousResult = await client.query<AssessmentRow>(
        `SELECT *
           FROM qassas_core.target_assessment
          WHERE target_id = $1
          ORDER BY assessment_version DESC, created_at DESC
          LIMIT 1`,
        [command.target_id],
      );
      const previous = previousResult.rows[0] ?? null;
      const nextVersion = (previous?.assessment_version ?? 0) + 1;
      const assessmentId = `TA-${randomUUID()}`;

      const newScore = this.calculateScore(
        command.dimensions,
        command.cost_to_next_decision_sar,
        command.expected_information_gain,
        weights,
      );

      await client.query(
        `INSERT INTO qassas_core.target_assessment (
           assessment_id, target_id, decision_id, assessment_version,
           geological_potential, evidence_confidence, technical_maturity,
           scale_potential, strategic_adjacency,
           cost_to_next_decision_score, work_commitment_risk_score,
           partner_constraint_score, data_quality,
           cost_to_next_decision_sar, expected_information_gain,
           evidence_snapshot_id, rationale, assessed_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
         )`,
        [
          assessmentId,
          command.target_id,
          command.decision_id ?? null,
          nextVersion,
          command.dimensions.geological_potential,
          command.dimensions.evidence_confidence,
          command.dimensions.technical_maturity,
          command.dimensions.scale_potential,
          command.dimensions.strategic_adjacency,
          command.dimensions.cost_to_next_decision,
          command.dimensions.work_commitment_risk,
          command.dimensions.partner_constraint,
          command.dimensions.data_quality,
          command.cost_to_next_decision_sar,
          command.expected_information_gain,
          command.evidence_snapshot_id ?? null,
          {
            narrative: command.rationale,
            trigger_type: command.trigger_type,
          },
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "TargetAssessmentCreated",
        objectType: "TargetAssessment",
        objectId: assessmentId,
        objectVersion: nextVersion,
        actorId: actor.userId,
        actorRole: "EXPLORATION_DIRECTOR",
        tenantId: target.enterprise_id,
        correlationId,
        payload: {
          target_id: command.target_id,
          decision_id: command.decision_id ?? null,
          assessment_version: nextVersion,
          ppi: newScore.ppi,
          voi_points_per_million_sar: newScore.voi,
          score_authorises_execution: false,
        },
      });

      let reassessment = null;
      if (previous) {
        const previousScore = this.calculateScore(
          this.dimensionsFromAssessment(previous),
          Number(previous.cost_to_next_decision_sar),
          Number(previous.expected_information_gain),
          weights,
        );
        const reassessmentId = `PRA-${randomUUID()}`;
        const ppiDelta = this.round(newScore.ppi - previousScore.ppi, 2);
        const voiDelta = this.round(newScore.voi - previousScore.voi, 4);

        await client.query(
          `INSERT INTO qassas_core.portfolio_reassessment (
             reassessment_id, enterprise_id, asset_id, target_id, decision_id,
             recommendation_delta_id, previous_assessment_id, new_assessment_id,
             previous_ppi, new_ppi, ppi_delta,
             previous_voi_points_per_million_sar,
             new_voi_points_per_million_sar, voi_delta,
             trigger_type, rationale, created_by_user_id
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
           )`,
          [
            reassessmentId,
            target.enterprise_id,
            target.asset_id,
            command.target_id,
            command.decision_id ?? null,
            command.recommendation_delta_id ?? null,
            previous.assessment_id,
            assessmentId,
            previousScore.ppi,
            newScore.ppi,
            ppiDelta,
            previousScore.voi,
            newScore.voi,
            voiDelta,
            command.trigger_type,
            command.rationale,
            actor.userId,
          ],
        );

        await this.events.write(client, {
          eventType: "PortfolioReassessmentRecorded",
          objectType: "PortfolioReassessment",
          objectId: reassessmentId,
          objectVersion: 1,
          actorId: actor.userId,
          actorRole: "EXPLORATION_DIRECTOR",
          tenantId: target.enterprise_id,
          correlationId,
          payload: {
            asset_id: target.asset_id,
            target_id: command.target_id,
            previous_assessment_id: previous.assessment_id,
            new_assessment_id: assessmentId,
            ppi_delta: ppiDelta,
            voi_delta: voiDelta,
            recommendation_delta_id: command.recommendation_delta_id ?? null,
            automatic_execution_consequence: false,
          },
        });

        reassessment = {
          reassessment_id: reassessmentId,
          previous_assessment_id: previous.assessment_id,
          new_assessment_id: assessmentId,
          previous_ppi: previousScore.ppi,
          new_ppi: newScore.ppi,
          ppi_delta: ppiDelta,
          previous_voi_points_per_million_sar: previousScore.voi,
          new_voi_points_per_million_sar: newScore.voi,
          voi_delta: voiDelta,
        };
      }

      const response = {
        assessment_id: assessmentId,
        target_id: command.target_id,
        decision_id: command.decision_id ?? null,
        assessment_version: nextVersion,
        portfolio_priority_index: newScore.ppi,
        voi_points_per_million_sar: newScore.voi,
        score_authorises_execution: false,
        automatic_gate_consequence: false,
        automatic_capital_consequence: false,
        reassessment,
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "CreateTargetAssessment",
        idempotencyKey,
        requestHash,
        response,
      );

      return response;
    });

    return result;
  }

  async reassessmentHistory(assetId: string, actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    const asset = await this.getAssetRow(assetId);
    if (!asset) throw new NotFoundException();
    if (!(await this.canRead(actor, asset))) throw new NotFoundException();

    const result = await this.database.query<ReassessmentRow>(
      `SELECT reassessment_id, target_id, decision_id,
              recommendation_delta_id, previous_assessment_id,
              new_assessment_id, previous_ppi, new_ppi, ppi_delta,
              previous_voi_points_per_million_sar,
              new_voi_points_per_million_sar, voi_delta,
              trigger_type, rationale, created_at
         FROM qassas_core.portfolio_reassessment
        WHERE asset_id = $1
        ORDER BY created_at DESC, reassessment_id DESC`,
      [assetId],
    );

    return {
      asset_id: assetId,
      reassessments: result.rows.map((row) => ({
        reassessment_id: row.reassessment_id,
        target_id: row.target_id,
        decision_id: row.decision_id,
        recommendation_delta_id: row.recommendation_delta_id,
        previous_assessment_id: row.previous_assessment_id,
        new_assessment_id: row.new_assessment_id,
        previous_ppi: Number(row.previous_ppi),
        new_ppi: Number(row.new_ppi),
        ppi_delta: Number(row.ppi_delta),
        previous_voi_points_per_million_sar: Number(
          row.previous_voi_points_per_million_sar,
        ),
        new_voi_points_per_million_sar: Number(
          row.new_voi_points_per_million_sar,
        ),
        voi_delta: Number(row.voi_delta),
        trigger_type: row.trigger_type,
        rationale: row.rationale,
        created_at: row.created_at.toISOString(),
      })),
    };
  }

  async createScenario(
    actor: AuthenticatedActor,
    command: CreateScenarioCommand,
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    this.validateScenario(command);

    const visible = await this.visibleRows(actor);
    if (!visible.length) throw new NotFoundException();

    const model = await this.activeModel();
    const baselineWeights = this.weightsFromModel(model);
    const assessmentRefs = Object.fromEntries(
      visible
        .filter((row) => row.assessment_id !== null)
        .map((row) => [row.asset_id, row.assessment_id]),
    );
    const requestHash = this.hash(command);

    const calculations = visible.map((row) => {
      const dimensions = this.dimensionsFromRow(row);
      if (!dimensions || row.cost_to_next_decision_sar === null ||
          row.expected_information_gain === null) {
        return {
          row,
          baseline: null,
          scenario: null,
        };
      }
      return {
        row,
        baseline: this.calculateScore(
          dimensions,
          Number(row.cost_to_next_decision_sar),
          Number(row.expected_information_gain),
          baselineWeights,
        ),
        scenario: this.calculateScore(
          dimensions,
          Number(row.cost_to_next_decision_sar),
          Number(row.expected_information_gain),
          command.weights,
        ),
      };
    });

    const rankedScenario = calculations
      .filter((item) => item.scenario !== null)
      .sort((a, b) => b.scenario!.ppi - a.scenario!.ppi);
    const scenarioRank = new Map(
      rankedScenario.map((item, index) => [item.row.asset_id, index + 1]),
    );

    return this.database.transaction(async (client) => {
      const existing = await this.idempotentResult(
        client,
        actor.userId,
        "CreatePortfolioScenario",
        idempotencyKey,
        requestHash,
      );
      if (existing) return existing;

      const scenarioId = `PSC-${randomUUID()}`;
      await client.query(
        `INSERT INTO qassas_core.portfolio_scenario (
           scenario_id, enterprise_id, scenario_name,
           base_model_code, base_model_version,
           w_geological_potential, w_evidence_confidence,
           w_technical_maturity, w_scale_potential,
           w_strategic_adjacency, w_cost_to_next_decision,
           w_work_commitment_risk, w_partner_constraint, w_data_quality,
           assessment_refs, authoritative, purpose, created_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,$16,$17
         )`,
        [
          scenarioId,
          visible[0].enterprise_id,
          command.scenario_name,
          model.model_code,
          model.model_version,
          command.weights.geological_potential,
          command.weights.evidence_confidence,
          command.weights.technical_maturity,
          command.weights.scale_potential,
          command.weights.strategic_adjacency,
          command.weights.cost_to_next_decision,
          command.weights.work_commitment_risk,
          command.weights.partner_constraint,
          command.weights.data_quality,
          assessmentRefs,
          command.purpose,
          actor.userId,
        ],
      );

      await this.events.write(client, {
        eventType: "PortfolioScenarioCreated",
        objectType: "PortfolioScenario",
        objectId: scenarioId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: this.actorRole(actor),
        tenantId: visible[0].enterprise_id,
        correlationId,
        payload: {
          scenario_name: command.scenario_name,
          purpose: command.purpose,
          authoritative: false,
          assessment_refs: assessmentRefs,
        },
      });

      const response = {
        scenario_id: scenarioId,
        scenario_name: command.scenario_name,
        purpose: command.purpose,
        authoritative: false,
        automatic_execution_consequence: false,
        automatic_gate_consequence: false,
        automatic_capital_consequence: false,
        assets: calculations.map((item) => ({
          decision_object_key: item.row.decision_object_key,
          asset_id: item.row.asset_id,
          asset_name: item.row.asset_name,
          governance_state: item.row.governance_state,
          baseline_ppi: item.baseline?.ppi ?? null,
          baseline_rank:
            item.row.priority_rank === null
              ? null
              : Number(item.row.priority_rank),
          scenario_ppi: item.scenario?.ppi ?? null,
          scenario_rank: scenarioRank.get(item.row.asset_id) ?? null,
          ppi_delta:
            item.baseline && item.scenario
              ? this.round(item.scenario.ppi - item.baseline.ppi, 2)
              : null,
          voi_points_per_million_sar: item.scenario?.voi ?? null,
          score_authorises_execution: false,
        })),
      };

      await this.storeIdempotency(
        client,
        actor.userId,
        "CreatePortfolioScenario",
        idempotencyKey,
        requestHash,
        response,
      );

      return response;
    });
  }

  private async visibleRows(actor: AuthenticatedActor) {
    const result = await this.database.query<PortfolioIntelligenceRow>(
      `SELECT *
         FROM qassas_core.portfolio_intelligence_read_model
        ORDER BY priority_rank NULLS LAST, display_order`,
    );
    return this.authorisedRows(actor, result.rows);
  }

  private async getAssetRow(assetId: string) {
    const result = await this.database.query<PortfolioIntelligenceRow>(
      `SELECT *
         FROM qassas_core.portfolio_intelligence_read_model
        WHERE asset_id = $1
        LIMIT 1`,
      [assetId],
    );
    return result.rows[0] ?? null;
  }

  private boardAssetView(row: PortfolioIntelligenceRow) {
    const score = (value: string | null) =>
      value === null ? null : Number(value);

    return {
      decision_object_key: row.decision_object_key,
      asset_id: row.asset_id,
      asset_name: row.asset_name,
      decision_class: row.decision_class,
      configured_gate: row.configured_gate,
      decision_id: row.decision_id,
      decision_state: row.decision_state,
      decision_gate: row.decision_gate,

      assessment: {
        assessment_id: row.assessment_id,
        assessment_version:
          row.assessment_version === null
            ? null
            : Number(row.assessment_version),
        dimensions: {
          geological_potential: score(row.geological_potential),
          evidence_confidence: score(row.evidence_confidence),
          technical_maturity: score(row.technical_maturity),
          scale_potential: score(row.scale_potential),
          strategic_adjacency: score(row.strategic_adjacency),
          cost_to_next_decision:
            score(row.cost_to_next_decision_score),
          work_commitment_risk:
            score(row.work_commitment_risk_score),
          partner_constraint: score(row.partner_constraint_score),
          data_quality: score(row.data_quality),
        },
        cost_to_next_decision_sar: score(row.cost_to_next_decision_sar),
        expected_information_gain: score(row.expected_information_gain),
        rationale: row.assessment_rationale ?? {},
      },

      prioritisation: {
        portfolio_priority_index: score(row.portfolio_priority_index),
        priority_rank:
          row.priority_rank === null ? null : Number(row.priority_rank),
        voi_points_per_million_sar:
          score(row.voi_points_per_million_sar),
        score_authorises_execution: row.score_authorises_execution,
      },

      governance: {
        governance_state: row.governance_state,
        evidence_control_state: row.evidence_control_state,
        blocking_gap_count: Number(row.blocking_gap_count ?? 0),
        blocking_conflict_count: Number(row.blocking_conflict_count ?? 0),
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        commitment_at_risk: row.commitment_at_risk,
        licence_at_risk: row.licence_at_risk,
        capital_state: row.capital_state,
        released_capital_total: Number(row.released_capital_total ?? 0),
        portfolio_attention_state: row.portfolio_attention_state,
        next_controlled_action: this.nextControlledAction(row),
      },

      last_activity_at: row.last_activity_at?.toISOString() ?? null,
    };
  }

  private nextControlledAction(row: PortfolioIntelligenceRow): string {
    if (row.decision_id === null) return "OPEN_DECISION";
    if ((row.blocking_conflict_count ?? 0) > 0) {
      return "RESOLVE_EVIDENCE_CONFLICT";
    }
    if ((row.blocking_gap_count ?? 0) > 0) {
      return "CLOSE_BLOCKING_DATA_GAP";
    }
    if (row.licence_at_risk === true) return "RESOLVE_LICENCE_RISK";
    if (row.commitment_at_risk === true) return "RESOLVE_WORK_COMMITMENT";
    if (row.partner_approval_required === true) {
      return "OBTAIN_PARTNER_CONSENT";
    }
    if (row.capital_state === "BLOCKED") return "RESOLVE_CAPITAL_BLOCK";
    if (row.capital_state === "APPROVED") return "ASSESS_EXECUTION_RELEASE";
    if (row.capital_state === "RELEASED") return "MONITOR_EXECUTION_OUTCOME";
    return "HUMAN_REVIEW";
  }

  private async targetContext(targetId: string) {
    const result = await this.database.query<TargetContextRow>(
      `SELECT target_id, enterprise_id, asset_id, security_class
         FROM qassas_core.target
        WHERE target_id = $1
        LIMIT 1`,
      [targetId],
    );
    return result.rows[0] ?? null;
  }

  private async authorizeTarget(
    actor: AuthenticatedActor,
    target: TargetContextRow,
  ) {
    const allowed = await this.policy.canReadTarget(actor, {
      targetId: target.target_id,
      assetId: target.asset_id!,
      securityClass: target.security_class,
    });
    if (!allowed.allow) throw new NotFoundException();
  }

  private async activeModel(): Promise<ScoringModelRow> {
    const result = await this.database.query<ScoringModelRow>(
      `SELECT model_code, model_version,
              w_geological_potential, w_evidence_confidence,
              w_technical_maturity, w_scale_potential,
              w_strategic_adjacency, w_cost_to_next_decision,
              w_work_commitment_risk, w_partner_constraint, w_data_quality
         FROM qassas_core.portfolio_scoring_model
        WHERE model_code = 'PPI'
          AND active = true
        ORDER BY model_version DESC
        LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new ConflictException({ code: "QAS-SCORING-MODEL-NOT-ACTIVE" });
    }
    return row;
  }

  private weightsFromModel(model: ScoringModelRow): PortfolioScoreWeights {
    return {
      geological_potential: Number(model.w_geological_potential),
      evidence_confidence: Number(model.w_evidence_confidence),
      technical_maturity: Number(model.w_technical_maturity),
      scale_potential: Number(model.w_scale_potential),
      strategic_adjacency: Number(model.w_strategic_adjacency),
      cost_to_next_decision: Number(model.w_cost_to_next_decision),
      work_commitment_risk: Number(model.w_work_commitment_risk),
      partner_constraint: Number(model.w_partner_constraint),
      data_quality: Number(model.w_data_quality),
    };
  }

  private calculateScore(
    dimensions: TargetAssessmentDimensions,
    costSar: number,
    expectedInformationGain: number,
    weights: PortfolioScoreWeights,
  ) {
    const ppi =
      dimensions.geological_potential * weights.geological_potential +
      dimensions.evidence_confidence * weights.evidence_confidence +
      dimensions.technical_maturity * weights.technical_maturity +
      dimensions.scale_potential * weights.scale_potential +
      dimensions.strategic_adjacency * weights.strategic_adjacency +
      (100 - dimensions.cost_to_next_decision) *
        weights.cost_to_next_decision +
      (100 - dimensions.work_commitment_risk) *
        weights.work_commitment_risk +
      (100 - dimensions.partner_constraint) *
        weights.partner_constraint +
      dimensions.data_quality * weights.data_quality;

    const voi = (expectedInformationGain / costSar) * 1_000_000;

    return {
      ppi: this.round(ppi, 2),
      voi: this.round(voi, 4),
    };
  }

  private dimensionsFromAssessment(
    row: AssessmentRow,
  ): TargetAssessmentDimensions {
    return {
      geological_potential: Number(row.geological_potential),
      evidence_confidence: Number(row.evidence_confidence),
      technical_maturity: Number(row.technical_maturity),
      scale_potential: Number(row.scale_potential),
      strategic_adjacency: Number(row.strategic_adjacency),
      cost_to_next_decision: Number(row.cost_to_next_decision_score),
      work_commitment_risk: Number(row.work_commitment_risk_score),
      partner_constraint: Number(row.partner_constraint_score),
      data_quality: Number(row.data_quality),
    };
  }

  private dimensionsFromRow(
    row: PortfolioIntelligenceRow,
  ): TargetAssessmentDimensions | null {
    const values = [
      row.geological_potential,
      row.evidence_confidence,
      row.technical_maturity,
      row.scale_potential,
      row.strategic_adjacency,
      row.cost_to_next_decision_score,
      row.work_commitment_risk_score,
      row.partner_constraint_score,
      row.data_quality,
    ];
    if (values.some((value) => value === null)) return null;

    return {
      geological_potential: Number(row.geological_potential),
      evidence_confidence: Number(row.evidence_confidence),
      technical_maturity: Number(row.technical_maturity),
      scale_potential: Number(row.scale_potential),
      strategic_adjacency: Number(row.strategic_adjacency),
      cost_to_next_decision: Number(row.cost_to_next_decision_score),
      work_commitment_risk: Number(row.work_commitment_risk_score),
      partner_constraint: Number(row.partner_constraint_score),
      data_quality: Number(row.data_quality),
    };
  }

  private validateAssessmentCommand(command: CreateTargetAssessmentCommand) {
    this.requireText(command.target_id, "target_id");
    this.requireText(command.trigger_type, "trigger_type");
    this.requireText(command.rationale, "rationale");

    for (const [name, value] of Object.entries(command.dimensions ?? {})) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(
          `${name} must be a number between 0 and 100`,
        );
      }
    }

    const requiredDimensions = [
      "geological_potential",
      "evidence_confidence",
      "technical_maturity",
      "scale_potential",
      "strategic_adjacency",
      "cost_to_next_decision",
      "work_commitment_risk",
      "partner_constraint",
      "data_quality",
    ];
    for (const name of requiredDimensions) {
      if (!Object.hasOwn(command.dimensions ?? {}, name)) {
        throw new BadRequestException(`${name} is required`);
      }
    }

    if (
      !Number.isFinite(command.cost_to_next_decision_sar) ||
      command.cost_to_next_decision_sar <= 0
    ) {
      throw new BadRequestException(
        "cost_to_next_decision_sar must be positive",
      );
    }
    if (
      !Number.isFinite(command.expected_information_gain) ||
      command.expected_information_gain < 0 ||
      command.expected_information_gain > 100
    ) {
      throw new BadRequestException(
        "expected_information_gain must be between 0 and 100",
      );
    }
  }

  private validateScenario(command: CreateScenarioCommand) {
    this.requireText(command.scenario_name, "scenario_name");
    this.requireText(command.purpose, "purpose");
    const values = Object.values(command.weights ?? {});
    if (values.length !== 9) {
      throw new BadRequestException("all nine scenario weights are required");
    }
    for (const value of values) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new BadRequestException(
          "scenario weights must be between 0 and 1",
        );
      }
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    if (Math.abs(sum - 1) > 0.000001) {
      throw new BadRequestException("scenario weights must sum to 1");
    }
  }

  private requireText(value: string | undefined | null, name: string) {
    if (!value?.trim()) throw new BadRequestException(`${name} is required`);
  }

  private round(value: number, digits: number) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  private actorRole(actor: AuthenticatedActor) {
    return actor.roleAssignments[0]?.roleType ?? null;
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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

  private requireAnyRole(actor: AuthenticatedActor, roles: string[]) {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (!roles.includes(role.roleType) || role.status !== "ACTIVE") {
        return false;
      }
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });

    if (!allowed) throw new NotFoundException();
  }

  private async authorisedRows(
    actor: AuthenticatedActor,
    rows: PortfolioIntelligenceRow[],
  ): Promise<PortfolioIntelligenceRow[]> {
    const visible: PortfolioIntelligenceRow[] = [];
    for (const row of rows) {
      if (await this.canRead(actor, row)) visible.push(row);
    }
    return visible;
  }

  private async canRead(
    actor: AuthenticatedActor,
    row: PortfolioIntelligenceRow,
  ) {
    const result = await this.policy.canReadTarget(actor, {
      targetId: row.primary_target_id,
      assetId: row.asset_id,
      securityClass: row.security_class,
    });
    return result.allow;
  }
}
