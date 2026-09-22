import { Injectable, NotFoundException } from "@nestjs/common";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface IntelligenceRow {
  profile_id: string;
  enterprise_id: string;
  asset_id: string;
  asset_name: string;
  decision_object_key: string;
  decision_class: string;
  configured_gate: string;
  workflow_template_code: string;
  primary_target_id: string;
  secondary_target_ids: string[];
  display_order: number;
  security_class: string;
  pilot_status: string;
  decision_id: string | null;
  decision_state: string | null;
  decision_object_version: string | null;
  decision_gate: string | null;
  evidence_control_state: string | null;
  blocking_gap_count: number | null;
  blocking_conflict_count: number | null;
  recommendation_id: string | null;
  recommendation_review_status: string | null;
  partner_approval_required: boolean | null;
  partner_consent_status: string | null;
  work_commitment_risk: string | null;
  commitment_at_risk: boolean | null;
  licence_at_risk: boolean | null;
  execution_allowed: boolean | null;
  capital_request_id: string | null;
  capital_type: string | null;
  requested_amount: string | null;
  currency: string | null;
  capital_state: string | null;
  released_capital_total: string | null;
  capital_release_count: number | null;
  portfolio_attention_state: string | null;
  last_activity_at: Date | null;
  queue_state: string;
  assessment_id: string | null;
  model_version: string | null;
  geological_potential: string | null;
  evidence_confidence: string | null;
  technical_maturity: string | null;
  scale_potential: string | null;
  strategic_adjacency: string | null;
  cost_efficiency: string | null;
  data_quality: string | null;
  priority_work_commitment_risk: string | null;
  partner_constraint: string | null;
  next_decision_cost_sar: string | null;
  expected_information_gain_points: string | null;
  priority_index: string | null;
  voi_points_per_million_sar: string | null;
  priority_rationale: string | null;
  assessed_by_user_id: string | null;
  priority_assessed_at: Date | null;
  action_model_version: string | null;
  advisory_action_class: string | null;
  action_rationale: string | null;
  action_input_snapshot: Record<string, unknown> | null;
}

interface RankedRow extends IntelligenceRow {
  priority_position: number | null;
  voi_position: number | null;
}

@Injectable()
export class PortfolioIntelligenceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  async priorityQueue(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    const visible = await this.visibleRows(actor);
    const ranked = this.rankVisible(visible);

    return {
      interface: "PORTFOLIO_PRIORITY_QUEUE",
      score_authority: "ADVISORY_ONLY",
      visible_asset_count: ranked.length,
      model_version: this.singleModelVersion(ranked),
      assets: ranked
        .sort((a, b) => this.score(b.priority_index) - this.score(a.priority_index))
        .map((row) => this.priorityView(row)),
    };
  }

  async controlBoard(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE"]);
    const visible = await this.visibleRows(actor);
    const ranked = this.rankVisible(visible);

    const totalRequested = ranked.reduce(
      (sum, row) => sum + this.score(row.requested_amount),
      0,
    );
    const totalReleased = ranked.reduce(
      (sum, row) => sum + this.score(row.released_capital_total),
      0,
    );

    return {
      interface: "PORTFOLIO_CONTROL_BOARD",
      score_authority: "ADVISORY_ONLY",
      execution_authority: "GOVERNED_OUTSIDE_SCORE",
      visible_asset_count: ranked.length,
      model_version: this.singleModelVersion(ranked),
      summary: {
        queue_state_counts: this.countBy(ranked, (row) => row.queue_state),
        attention_state_counts: this.countBy(
          ranked,
          (row) => row.portfolio_attention_state ?? "UNASSESSED",
        ),
        priority_signal_counts: this.countBy(
          ranked,
          (row) => this.prioritySignal(this.score(row.priority_index)),
        ),
        advisory_action_counts: this.countBy(
          ranked,
          (row) => row.advisory_action_class ?? "UNCLASSIFIED",
        ),
        governance_blocked_count: ranked.filter((row) =>
          this.governanceBlocked(row),
        ).length,
        evidence_blocked_count: ranked.filter(
          (row) =>
            Number(row.blocking_gap_count ?? 0) > 0 ||
            Number(row.blocking_conflict_count ?? 0) > 0,
        ).length,
        partner_approval_required_count: ranked.filter(
          (row) => row.partner_approval_required === true,
        ).length,
        requested_capital_total: totalRequested,
        released_capital_total: totalReleased,
      },
      priority_queue: ranked
        .slice()
        .sort((a, b) => this.score(b.priority_index) - this.score(a.priority_index))
        .map((row) => this.priorityView(row)),
      information_leverage: ranked
        .slice()
        .filter((row) => row.voi_points_per_million_sar !== null)
        .sort(
          (a, b) =>
            this.score(b.voi_points_per_million_sar) -
            this.score(a.voi_points_per_million_sar),
        )
        .map((row) => ({
          voi_position: row.voi_position,
          decision_object_key: row.decision_object_key,
          asset_id: row.asset_id,
          asset_name: row.asset_name,
          next_decision_cost_sar: this.nullableNumber(row.next_decision_cost_sar),
          expected_information_gain_points: this.nullableNumber(
            row.expected_information_gain_points,
          ),
          voi_points_per_million_sar: this.nullableNumber(
            row.voi_points_per_million_sar,
          ),
          governance_blocked: this.governanceBlocked(row),
        })),
    };
  }

  async getAsset(assetId: string, actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    const ranked = this.rankVisible(await this.visibleRows(actor));
    const row = ranked.find((item) => item.asset_id === assetId);
    if (!row) throw new NotFoundException();

    return {
      ...this.priorityView(row),
      dimensions: {
        geological_potential: this.nullableNumber(row.geological_potential),
        evidence_confidence: this.nullableNumber(row.evidence_confidence),
        technical_maturity: this.nullableNumber(row.technical_maturity),
        scale_potential: this.nullableNumber(row.scale_potential),
        strategic_adjacency: this.nullableNumber(row.strategic_adjacency),
        cost_efficiency: this.nullableNumber(row.cost_efficiency),
        data_quality: this.nullableNumber(row.data_quality),
        work_commitment_risk: this.nullableNumber(row.priority_work_commitment_risk),
        partner_constraint: this.nullableNumber(row.partner_constraint),
      },
      rationale: row.priority_rationale,
      assessed_by_user_id: row.assessed_by_user_id,
      assessed_at: row.priority_assessed_at?.toISOString() ?? null,
    };
  }

  private async visibleRows(actor: AuthenticatedActor): Promise<IntelligenceRow[]> {
    const result = await this.database.query<IntelligenceRow>(
      "SELECT * FROM qassas_core.portfolio_action_classification_latest WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );
    const visible: IntelligenceRow[] = [];
    for (const row of result.rows) {
      const allowed = await this.policy.canReadTarget(actor, {
        targetId: row.primary_target_id,
        assetId: row.asset_id,
        securityClass: row.security_class,
      });
      if (allowed.allow) visible.push(row);
    }
    return visible;
  }

  private rankVisible(rows: IntelligenceRow[]): RankedRow[] {
    const prioritySorted = rows.filter((row) => row.priority_index !== null).slice().sort(
      (a, b) => this.score(b.priority_index) - this.score(a.priority_index),
    );
    const voiSorted = rows.filter((row) => row.voi_points_per_million_sar !== null).slice().sort(
      (a, b) => this.score(b.voi_points_per_million_sar) - this.score(a.voi_points_per_million_sar),
    );
    const priorityPosition = new Map(prioritySorted.map((row, index) => [row.profile_id, index + 1]));
    const voiPosition = new Map(voiSorted.map((row, index) => [row.profile_id, index + 1]));
    return rows.map((row) => ({
      ...row,
      priority_position: priorityPosition.get(row.profile_id) ?? null,
      voi_position: voiPosition.get(row.profile_id) ?? null,
    }));
  }

  private priorityView(row: RankedRow) {
    const priorityIndex = this.nullableNumber(row.priority_index);
    return {
      priority_position: row.priority_position,
      voi_position: row.voi_position,
      decision_object_key: row.decision_object_key,
      asset_id: row.asset_id,
      asset_name: row.asset_name,
      decision_class: row.decision_class,
      configured_gate: row.configured_gate,
      workflow_template_code: row.workflow_template_code,
      decision_id: row.decision_id,
      decision_state: row.decision_state,
      queue_state: row.queue_state,
      portfolio_attention_state: row.portfolio_attention_state,
      priority: {
        assessment_id: row.assessment_id,
        model_version: row.model_version,
        priority_index: priorityIndex,
        signal: priorityIndex === null ? "NOT_ASSESSED" : this.prioritySignal(priorityIndex),
      },
      value_of_information: {
        next_decision_cost_sar: this.nullableNumber(row.next_decision_cost_sar),
        expected_information_gain_points: this.nullableNumber(row.expected_information_gain_points),
        voi_points_per_million_sar: this.nullableNumber(row.voi_points_per_million_sar),
      },
      governance: {
        blocked: this.governanceBlocked(row),
        evidence_control_state: row.evidence_control_state,
        blocking_gap_count: Number(row.blocking_gap_count ?? 0),
        blocking_conflict_count: Number(row.blocking_conflict_count ?? 0),
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        commitment_at_risk: row.commitment_at_risk,
        licence_at_risk: row.licence_at_risk,
        execution_allowed: row.execution_allowed,
      },
      capital: {
        request_id: row.capital_request_id,
        type: row.capital_type,
        requested_amount: this.nullableNumber(row.requested_amount),
        currency: row.currency,
        state: row.capital_state,
        released_total: this.score(row.released_capital_total),
        release_count: Number(row.capital_release_count ?? 0),
      },
      advisory_action: {
        model_version: row.action_model_version,
        class: row.advisory_action_class,
        rationale: row.action_rationale,
        input_basis: row.action_input_snapshot ?? {},
        can_authorise_execution: false,
        can_release_capital: false,
        can_change_gate: false,
      },
      score_can_authorise_execution: false,
      score_can_release_capital: false,
      score_can_change_gate: false,
    };
  }

  private governanceBlocked(row: IntelligenceRow): boolean {
    return (
      row.portfolio_attention_state === "BLOCKED" ||
      row.partner_approval_required === true ||
      row.licence_at_risk === true ||
      row.commitment_at_risk === true ||
      Number(row.blocking_gap_count ?? 0) > 0 ||
      Number(row.blocking_conflict_count ?? 0) > 0
    );
  }

  private prioritySignal(score: number): "HIGH" | "MEDIUM" | "LOW" {
    if (score >= 75) return "HIGH";
    if (score >= 60) return "MEDIUM";
    return "LOW";
  }

  private countBy(rows: RankedRow[], selector: (row: RankedRow) => string): Record<string, number> {
    return rows.reduce<Record<string, number>>((acc, row) => {
      const key = selector(row);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private singleModelVersion(rows: RankedRow[]): string | null {
    const versions = [...new Set(rows.map((row) => row.model_version).filter(Boolean))];
    return versions.length === 1 ? (versions[0] as string) : null;
  }

  private requireAnyRole(actor: AuthenticatedActor, roles: string[]) {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (!roles.includes(role.roleType) || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
    if (!allowed) throw new NotFoundException();
  }

  private score(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private nullableNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
