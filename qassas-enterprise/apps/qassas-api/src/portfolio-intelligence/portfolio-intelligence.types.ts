export interface PortfolioIntelligenceRow {
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
  decision_gate: string | null;

  evidence_control_state: string | null;
  blocking_gap_count: number | null;
  blocking_conflict_count: number | null;
  partner_approval_required: boolean | null;
  partner_consent_status: string | null;
  work_commitment_risk: string | null;
  commitment_at_risk: boolean | null;
  licence_at_risk: boolean | null;
  capital_state: string | null;
  released_capital_total: string | null;
  portfolio_attention_state: string | null;
  last_activity_at: Date | null;

  assessment_id: string | null;
  assessment_version: number | null;
  geological_potential: string | null;
  evidence_confidence: string | null;
  technical_maturity: string | null;
  scale_potential: string | null;
  strategic_adjacency: string | null;
  cost_to_next_decision_score: string | null;
  work_commitment_risk_score: string | null;
  partner_constraint_score: string | null;
  data_quality: string | null;
  cost_to_next_decision_sar: string | null;
  expected_information_gain: string | null;
  assessment_evidence_snapshot_id: string | null;
  assessment_rationale: Record<string, unknown> | null;

  model_code: string;
  model_version: number;
  portfolio_priority_index: string | null;
  voi_points_per_million_sar: string | null;
  governance_state: string;
  priority_rank: string | null;
  score_authorises_execution: boolean;
}

export interface PortfolioScoreWeights {
  geological_potential: number;
  evidence_confidence: number;
  technical_maturity: number;
  scale_potential: number;
  strategic_adjacency: number;
  cost_to_next_decision: number;
  work_commitment_risk: number;
  partner_constraint: number;
  data_quality: number;
}

export interface TargetAssessmentDimensions {
  geological_potential: number;
  evidence_confidence: number;
  technical_maturity: number;
  scale_potential: number;
  strategic_adjacency: number;
  cost_to_next_decision: number;
  work_commitment_risk: number;
  partner_constraint: number;
  data_quality: number;
}

export interface CreateTargetAssessmentCommand {
  target_id: string;
  decision_id?: string | null;
  evidence_snapshot_id?: string | null;
  recommendation_delta_id?: string | null;
  trigger_type: string;
  rationale: string;
  dimensions: TargetAssessmentDimensions;
  cost_to_next_decision_sar: number;
  expected_information_gain: number;
}

export interface CreateScenarioCommand {
  scenario_name: string;
  purpose: string;
  weights: PortfolioScoreWeights;
}
