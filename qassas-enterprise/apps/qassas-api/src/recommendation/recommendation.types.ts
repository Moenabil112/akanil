export interface CreateCandidateActionCommand {
  action_code: string;
  title: string;
  description: string;
  cost_class?: "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | null;
  technical_risk?: string | null;
  partner_dependency?: boolean;
}

export interface ProposeNextBestTestCommand {
  candidate_action_id?: string | null;
  test_type: string;
  uncertainty_targeted: string;
  expected_information_gain: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  cost_class: "C0" | "C1" | "C2" | "C3" | "C4" | "C5";
  cost_range_min?: number | null;
  cost_range_max?: number | null;
  time_range?: string | null;
  dependencies?: string[];
  technical_risk?: string | null;
  decision_impact: string;
  required_authority: string;
}

export interface IssueRecommendationCommand {
  recommended_action_id: string;
  recommendation_text: string;
  rationale: string;
  confidence: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  model_version?: string | null;
  supersedes_recommendation_id?: string | null;
  change_trigger?: {
    trigger_type: string;
    trigger_evidence_ids?: string[];
    rationale: string;
    capital_impact?: string | null;
    gate_impact?: string | null;
  } | null;
}
