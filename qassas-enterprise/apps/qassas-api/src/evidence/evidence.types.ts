export interface RegisterEvidenceCommand {
  target_id: string;
  evidence_class: string;
  source_system: string;
  source_object_id?: string | null;
  source_org?: string | null;
  source_type?: string | null;
  source_date?: string | null;
  version_label?: string | null;
  observation?: string | null;
  qa_qc_status?: string | null;
}

export interface QualifyEvidenceCommand {
  validation_status: string;
  decision_fitness: string;
  confidence_class: "A" | "B" | "C";
  limitations?: string | null;
  rationale: string;
}

export interface CreateEvidenceSnapshotCommand {
  target_id: string;
  evidence_ids: string[];
}

export interface OpenDataGapCommand {
  target_id: string;
  decision_id?: string | null;
  required_information: string;
  why_required: string;
  potential_source?: string | null;
  cost_class?: string | null;
  decision_impact: string;
  blocking_status: "BLOCKING" | "ADVISORY";
}

export interface OpenEvidenceConflictCommand {
  target_id: string;
  decision_id?: string | null;
  evidence_ids: string[];
  conflict_type: string;
  severity: "CF-1" | "CF-2" | "CF-3" | "CF-4" | "CF-5";
  technical_interpretation: string;
  decision_impact: string;
  resolution_method?: string | null;
}
