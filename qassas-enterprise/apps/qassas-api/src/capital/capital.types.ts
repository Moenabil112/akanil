export interface CreateCapitalRequestCommand {
  decision_id: string;
  capital_type: "DECISION_CAPITAL" | "EXECUTION_CAPITAL";
  requested_amount: number;
  currency: string;
  purpose: string;
  funding_source?: string | null;
}

export interface CapitalApprovalCommand {
  approved_amount: number;
  rationale: string;
}

export interface CapitalReleaseCommand {
  released_amount: number;
}

export interface CapitalReturnCommand {
  amount: number;
  reason: string;
}
