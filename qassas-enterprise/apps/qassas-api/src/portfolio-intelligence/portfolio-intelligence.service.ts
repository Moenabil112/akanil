import { Injectable, NotFoundException } from "@nestjs/common";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import type { PortfolioIntelligenceRow } from "./portfolio-intelligence.types";

@Injectable()
export class PortfolioIntelligenceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  async controlBoard(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);

    const result = await this.database.query<PortfolioIntelligenceRow>(
      `SELECT *
         FROM qassas_core.portfolio_intelligence_read_model
        ORDER BY priority_rank NULLS LAST, display_order`,
    );

    const visible = await this.authorisedRows(actor, result.rows);
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
      assets: visible.map((row) => this.boardView(row)),
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

    return this.boardView(row);
  }

  private boardView(row: PortfolioIntelligenceRow) {
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
    if (row.partner_approval_required === true) {
      return "OBTAIN_PARTNER_CONSENT";
    }
    if (row.capital_state === "BLOCKED") return "RESOLVE_CAPITAL_BLOCK";
    if (row.capital_state === "APPROVED") return "ASSESS_EXECUTION_RELEASE";
    if (row.capital_state === "RELEASED") return "MONITOR_EXECUTION_OUTCOME";
    return "HUMAN_REVIEW";
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
