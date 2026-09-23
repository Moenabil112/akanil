BEGIN;

CREATE OR REPLACE VIEW qassas_core.pilot_decision_queue AS
SELECT
  p.profile_id,
  p.enterprise_id,
  p.asset_id,
  p.asset_name,
  p.decision_object_key,
  p.decision_class,
  p.configured_gate,
  p.workflow_template_code,
  p.primary_target_id,
  p.secondary_target_ids,
  p.display_order,
  p.security_class,
  p.pilot_status,

  d.decision_id,
  d.state AS decision_state,
  d.object_version AS decision_object_version,
  d.current_gate AS decision_gate,

  pc.evidence_control_state,
  pc.blocking_gap_count,
  pc.blocking_conflict_count,
  pc.recommendation_id,
  pc.recommendation_review_status,

  CASE
    WHEN pc.partner_approval_required IS NOT NULL
      THEN pc.partner_approval_required
    WHEN COALESCE((p.configuration->>'jv_controlled')::boolean, false)
      THEN true
    ELSE false
  END AS partner_approval_required,

  CASE
    WHEN pc.partner_consent_status IS NOT NULL
      THEN pc.partner_consent_status
    WHEN COALESCE((p.configuration->>'jv_controlled')::boolean, false)
      THEN 'UNKNOWN'
    ELSE 'NOT_REQUIRED'
  END AS partner_consent_status,

  pc.work_commitment_risk,
  pc.commitment_at_risk,
  pc.licence_at_risk,
  pc.execution_allowed,
  pc.capital_request_id,
  pc.capital_type,
  pc.requested_amount,
  pc.currency,
  pc.capital_state,
  pc.released_capital_total,
  pc.capital_release_count,
  pc.portfolio_attention_state,
  pc.last_activity_at,

  CASE
    WHEN d.decision_id IS NULL THEN 'NOT_STARTED'
    WHEN pc.portfolio_attention_state IS NOT NULL
      THEN pc.portfolio_attention_state
    ELSE 'IN_PROGRESS'
  END AS queue_state

FROM qassas_core.pilot_asset_profile p

LEFT JOIN LATERAL (
  SELECT decision_id, state, object_version, current_gate
    FROM qassas_core.decision_object d0
   WHERE d0.target_id = p.primary_target_id
     AND d0.decision_class = p.decision_class
   ORDER BY d0.updated_at DESC, d0.decision_id DESC
   LIMIT 1
) d ON true

LEFT JOIN qassas_core.portfolio_control_read_model pc
  ON pc.decision_id = d.decision_id;

COMMIT;
