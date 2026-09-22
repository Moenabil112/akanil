BEGIN;

CREATE OR REPLACE VIEW qassas_core.portfolio_control_read_model AS
SELECT
  d.decision_id,
  t.enterprise_id,
  t.asset_id,
  t.target_id,
  d.current_gate,
  d.state AS decision_state,
  d.object_version AS decision_object_version,
  d.evidence_snapshot_id,

  COALESCE(deb.blocking_gap_count, 0) AS blocking_gap_count,
  COALESCE(deb.blocking_conflict_count, 0) AS blocking_conflict_count,
  CASE
    WHEN COALESCE(deb.blocking_conflict_count, 0) > 0
      THEN 'ER-2_CONTRADICTORY_EVIDENCE'
    WHEN COALESCE(deb.blocking_gap_count, 0) > 0
      THEN 'ER-1_MISSING_EVIDENCE'
    ELSE 'CLEAR'
  END AS evidence_control_state,

  rec.recommendation_id,
  rec.recommendation_version,
  rr.review_status AS recommendation_review_status,

  rca.assessment_id AS rights_assessment_id,
  rca.partner_approval_required,
  rca.partner_consent_status,
  rca.work_commitment_risk,
  rca.commitment_at_risk,
  rca.licence_at_risk,
  rca.execution_allowed,
  rca.blocking_reasons AS rights_blocking_reasons,

  cap.capital_request_id,
  cap.capital_type,
  cap.requested_amount,
  cap.currency,
  cap.state AS capital_state,
  cga.all_required_gates_pass,
  cga.blocking_reasons AS capital_blocking_reasons,
  COALESCE(caps.released_capital_total, 0) AS released_capital_total,
  COALESCE(caps.release_count, 0) AS capital_release_count,

  CASE
    WHEN d.state IN (
      'CONFLICT_RESOLUTION_REQUIRED',
      'PARTNER_APPROVAL_REQUIRED'
    ) THEN 'BLOCKED'
    WHEN cap.state = 'BLOCKED' THEN 'BLOCKED'
    WHEN COALESCE(rca.licence_at_risk, false) THEN 'BLOCKED'
    WHEN COALESCE(rca.partner_approval_required, false) THEN 'BLOCKED'
    WHEN cap.state = 'RELEASED' THEN 'EXECUTION_FUNDED'
    WHEN cap.state = 'APPROVED' THEN 'CAPITAL_APPROVED_NOT_RELEASED'
    WHEN d.state = 'DECISION_READY' THEN 'ACTIONABLE'
    ELSE 'MONITOR'
  END AS portfolio_attention_state,

  GREATEST(
    d.updated_at,
    COALESCE(deb.bound_at, d.updated_at),
    COALESCE(rec.created_at, d.updated_at),
    COALESCE(rr.created_at, d.updated_at),
    COALESCE(rca.created_at, d.updated_at),
    COALESCE(cap.updated_at, d.updated_at),
    COALESCE(cga.created_at, d.updated_at)
  ) AS last_activity_at

FROM qassas_core.decision_object d
JOIN qassas_core.target t
  ON t.target_id = d.target_id

LEFT JOIN LATERAL (
  SELECT binding_id, blocking_gap_count, blocking_conflict_count, bound_at
    FROM qassas_core.decision_evidence_binding b
   WHERE b.decision_id = d.decision_id
   ORDER BY bound_at DESC, binding_id DESC
   LIMIT 1
) deb ON true

LEFT JOIN LATERAL (
  SELECT recommendation_id, recommendation_version, created_at
    FROM qassas_core.recommendation r
   WHERE r.decision_id = d.decision_id
   ORDER BY recommendation_version DESC
   LIMIT 1
) rec ON true

LEFT JOIN qassas_core.recommendation_review rr
  ON rr.recommendation_id = rec.recommendation_id

LEFT JOIN LATERAL (
  SELECT assessment_id, partner_approval_required, partner_consent_status,
         work_commitment_risk, commitment_at_risk, licence_at_risk,
         execution_allowed, blocking_reasons, created_at
    FROM qassas_core.decision_constraint_assessment a
   WHERE a.decision_id = d.decision_id
   ORDER BY created_at DESC, assessment_id DESC
   LIMIT 1
) rca ON true

LEFT JOIN LATERAL (
  SELECT capital_request_id, capital_type, requested_amount, currency,
         state, updated_at
    FROM qassas_core.capital_request c
   WHERE c.decision_id = d.decision_id
   ORDER BY updated_at DESC, capital_request_id DESC
   LIMIT 1
) cap ON true

LEFT JOIN LATERAL (
  SELECT assessment_id, all_required_gates_pass, blocking_reasons, created_at
    FROM qassas_core.capital_gate_assessment g
   WHERE g.capital_request_id = cap.capital_request_id
   ORDER BY created_at DESC, assessment_id DESC
   LIMIT 1
) cga ON true

LEFT JOIN LATERAL (
  SELECT
    COALESCE(sum(cr.released_amount), 0) AS released_capital_total,
    count(cr.release_id)::int AS release_count
  FROM qassas_core.capital_release cr
  JOIN qassas_core.capital_request cq
    ON cq.capital_request_id = cr.capital_request_id
  WHERE cq.decision_id = d.decision_id
) caps ON true;

COMMIT;
