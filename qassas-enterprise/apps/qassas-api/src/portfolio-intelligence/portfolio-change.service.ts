import { Injectable, NotFoundException } from "@nestjs/common";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface ChangeRow {
  delta_id: string;
  decision_id: string;
  profile_id: string;
  asset_id: string;
  asset_name: string;
  decision_object_key: string;
  security_class: string;
  trigger_type: string;
  trigger_evidence_ids: string[];
  change_rationale: string;
  capital_impact: string | null;
  gate_impact: string | null;
  changed_at: Date;
  previous_recommendation_id: string;
  previous_recommendation_version: number;
  previous_action_id: string;
  previous_recommendation_text: string;
  previous_confidence: string;
  new_recommendation_id: string;
  new_recommendation_version: number;
  new_action_id: string;
  new_recommendation_text: string;
  new_confidence: string;
  action_changed: boolean;
  confidence_changed: boolean;
  capital_impact_present: boolean;
  gate_impact_present: boolean;
  portfolio_attention_state: string | null;
  partner_approval_required: boolean | null;
  partner_consent_status: string | null;
  capital_state: string | null;
  released_capital_total: string | null;
}

@Injectable()
export class PortfolioChangeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  async changeFeed(actor: AuthenticatedActor) {
    this.requireAnyRole(actor, ["PORTFOLIO_EXECUTIVE", "EXPLORATION_DIRECTOR"]);
    const result = await this.database.query<ChangeRow>(
      "SELECT * FROM qassas_core.portfolio_change_feed ORDER BY changed_at DESC, delta_id DESC",
    );

    const visible: ChangeRow[] = [];
    for (const row of result.rows) {
      const target = await this.database.query<{ primary_target_id: string }>(
        "SELECT primary_target_id FROM qassas_core.pilot_asset_profile WHERE profile_id = $1 LIMIT 1",
        [row.profile_id],
      );
      const targetId = target.rows[0]?.primary_target_id;
      if (!targetId) continue;
      const allowed = await this.policy.canReadTarget(actor, {
        targetId,
        assetId: row.asset_id,
        securityClass: row.security_class,
      });
      if (allowed.allow) visible.push(row);
    }

    return {
      interface: "PORTFOLIO_CHANGE_FEED",
      visible_change_count: visible.length,
      changes: visible.map((row) => ({
        delta_id: row.delta_id,
        decision_id: row.decision_id,
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        trigger_type: row.trigger_type,
        trigger_evidence_ids: row.trigger_evidence_ids ?? [],
        changed_at: row.changed_at.toISOString(),
        rationale: row.change_rationale,
        previous: {
          recommendation_id: row.previous_recommendation_id,
          version: row.previous_recommendation_version,
          action_id: row.previous_action_id,
          text: row.previous_recommendation_text,
          confidence: row.previous_confidence,
        },
        next: {
          recommendation_id: row.new_recommendation_id,
          version: row.new_recommendation_version,
          action_id: row.new_action_id,
          text: row.new_recommendation_text,
          confidence: row.new_confidence,
        },
        change_flags: {
          action_changed: row.action_changed,
          confidence_changed: row.confidence_changed,
          capital_impact_present: row.capital_impact_present,
          gate_impact_present: row.gate_impact_present,
        },
        impacts: {
          capital: row.capital_impact,
          gate: row.gate_impact,
        },
        governance_context: {
          portfolio_attention_state: row.portfolio_attention_state,
          partner_approval_required: row.partner_approval_required,
          partner_consent_status: row.partner_consent_status,
          capital_state: row.capital_state,
          released_capital_total: Number(row.released_capital_total ?? 0),
        },
        change_can_approve_decision: false,
        change_can_release_capital: false,
        change_can_change_gate: false,
      })),
    };
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
}
