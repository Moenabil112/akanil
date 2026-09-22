export interface PilotQueueRow {
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
}

export interface WorkflowTemplateRow {
  template_code: string;
  template_name: string;
  decision_class: string;
  initial_gate: string;
  required_evidence_classes: string[];
  default_reviewer_role: string;
  rule_set_version: string;
  active: boolean;
  configuration: Record<string, unknown>;
}
