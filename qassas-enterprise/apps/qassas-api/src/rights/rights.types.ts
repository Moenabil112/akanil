export interface RegisterLicenceCommand {
  licence_id: string;
  licence_number: string;
  licence_type: string;
  licence_status: "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TRANSFER_PENDING";
  issue_date?: string | null;
  expiry_date?: string | null;
  transfer_status?: string | null;
  validation_status: "UNVERIFIED" | "VALIDATED" | "CONFLICTED";
  source_instrument?: string | null;
}

export interface AddLicencePartyRoleCommand {
  party_name: string;
  role_type:
    | "LEGAL_HOLDER"
    | "OPERATOR"
    | "BENEFICIAL_INTEREST"
    | "ECONOMIC_INTEREST"
    | "FUNDING_PARTY"
    | "JV_PARTNER"
    | "DATA_RIGHTS_HOLDER";
  economic_interest_percentage?: number | null;
  source_instrument?: string | null;
}

export interface DefineJVConstraintCommand {
  jv_id: string;
  decision_class?: string | null;
  partner_name: string;
  reserved_matter: string;
  consent_required?: boolean;
  voting_threshold?: string | null;
  source_instrument?: string | null;
}

export interface RecordJVConsentCommand {
  consent_status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  effective_until?: string | null;
  rationale: string;
}

export interface CreateWorkCommitmentCommand {
  description: string;
  due_date: string;
  mandatory?: boolean;
  cost_class?: "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | null;
  status?: "OPEN" | "SATISFIED" | "WAIVED" | "OVERDUE";
}

export interface UpdateWorkCommitmentCommand {
  status: "OPEN" | "SATISFIED" | "WAIVED" | "OVERDUE";
  rationale: string;
}
