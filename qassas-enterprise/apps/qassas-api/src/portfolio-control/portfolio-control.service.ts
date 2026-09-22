import { Injectable, NotFoundException } from "@nestjs/common";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface ControlRow {
  decision_id: string;
  enterprise_id: string;
  asset_id: string | null;
  target_id: string;
  current_gate: string;
  decision_state: string;
  decision_object_version: string;
  evidence_snapshot_id: string | null;
  blocking_gap_count: number;
  blocking_conflict_count: number;
  evidence_control_state: string;
  recommendation_id: string | null;
  recommendation_version: number | null;
  recommendation_review_status: string | null;
  rights_assessment_id: string | null;
  partner_approval_required: boolean | null;
  partner_consent_status: string | null;
  work_commitment_risk: string | null;
  commitment_at_risk: boolean | null;
  licence_at_risk: boolean | null;
  execution_allowed: boolean | null;
  rights_blocking_reasons: string[] | null;
  capital_request_id: string | null;
  capital_type: string | null;
  requested_amount: string | null;
  currency: string | null;
  capital_state: string | null;
  all_required_gates_pass: boolean | null;
  capital_blocking_reasons: string[] | null;
  released_capital_total: string;
  capital_release_count: number;
  portfolio_attention_state: string;
  last_activity_at: Date;
}

@Injectable()
export class PortfolioControlService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  async getDecision(decisionId: string, actor: AuthenticatedActor) {
    const row = await this.loadOne(decisionId);
    if (!row?.asset_id) throw new NotFoundException();
    await this.authorize(actor, row);
    return this.view(row);
  }

  async listAsset(assetId: string, actor: AuthenticatedActor) {
    const result = await this.database.query<ControlRow>(
      `SELECT *
         FROM qassas_core.portfolio_control_read_model
        WHERE asset_id = $1
        ORDER BY last_activity_at DESC, decision_id`,
      [assetId],
    );

    if (!result.rows.length) throw new NotFoundException();
    const first = result.rows[0];
    if (!first.asset_id) throw new NotFoundException();
    await this.authorize(actor, first);

    return {
      asset_id: assetId,
      decision_count: result.rows.length,
      blocked_count: result.rows.filter(
        (row) => row.portfolio_attention_state === "BLOCKED",
      ).length,
      actionable_count: result.rows.filter(
        (row) => row.portfolio_attention_state === "ACTIONABLE",
      ).length,
      execution_funded_count: result.rows.filter(
        (row) => row.portfolio_attention_state === "EXECUTION_FUNDED",
      ).length,
      decisions: result.rows.map((row) => this.view(row)),
    };
  }

  private async loadOne(decisionId: string): Promise<ControlRow | null> {
    const result = await this.database.query<ControlRow>(
      `SELECT *
         FROM qassas_core.portfolio_control_read_model
        WHERE decision_id = $1
        LIMIT 1`,
      [decisionId],
    );
    return result.rows[0] ?? null;
  }

  private async authorize(actor: AuthenticatedActor, row: ControlRow) {
    const allowed = await this.policy.canReadTarget(actor, {
      targetId: row.target_id,
      assetId: row.asset_id!,
      securityClass: "C2_CONFIDENTIAL_TECHNICAL",
    });
    if (!allowed.allow) throw new NotFoundException();
  }

  private view(row: ControlRow) {
    return {
      decision_id: row.decision_id,
      enterprise_id: row.enterprise_id,
      asset_id: row.asset_id,
      target_id: row.target_id,
      current_gate: row.current_gate,
      decision_state: row.decision_state,
      decision_object_version: Number(row.decision_object_version),
      evidence_snapshot_id: row.evidence_snapshot_id,
      evidence: {
        blocking_gap_count: Number(row.blocking_gap_count),
        blocking_conflict_count: Number(row.blocking_conflict_count),
        control_state: row.evidence_control_state,
      },
      recommendation: {
        recommendation_id: row.recommendation_id,
        recommendation_version: row.recommendation_version,
        review_status: row.recommendation_review_status,
      },
      rights: {
        assessment_id: row.rights_assessment_id,
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        commitment_at_risk: row.commitment_at_risk,
        licence_at_risk: row.licence_at_risk,
        execution_allowed: row.execution_allowed,
        blocking_reasons: row.rights_blocking_reasons ?? [],
      },
      capital: {
        capital_request_id: row.capital_request_id,
        capital_type: row.capital_type,
        requested_amount:
          row.requested_amount === null ? null : Number(row.requested_amount),
        currency: row.currency,
        state: row.capital_state,
        all_required_gates_pass: row.all_required_gates_pass,
        blocking_reasons: row.capital_blocking_reasons ?? [],
        released_capital_total: Number(row.released_capital_total),
        release_count: Number(row.capital_release_count),
      },
      portfolio_attention_state: row.portfolio_attention_state,
      last_activity_at: row.last_activity_at.toISOString(),
    };
  }
}
