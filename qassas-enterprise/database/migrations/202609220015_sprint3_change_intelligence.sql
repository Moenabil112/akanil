BEGIN;

CREATE OR REPLACE VIEW qassas_core.portfolio_change_feed AS
SELECT
  rd.delta_id,
  rd.decision_id,
  p.profile_id,
  p.asset_id,
  p.asset_name,
  p.decision_object_key,
  p.security_class,
  rd.trigger_type,
  rd.trigger_evidence_ids,
  rd.rationale AS change_rationale,
  rd.capital_impact,
  rd.gate_impact,
  rd.created_at AS changed_at,

  prev.recommendation_id AS previous_recommendation_id,
  prev.recommendation_version AS previous_recommendation_version,
  prev.recommended_action_id AS previous_action_id,
  prev.recommendation_text AS previous_recommendation_text,
  prev.confidence AS previous_confidence,

  next.recommendation_id AS new_recommendation_id,
  next.recommendation_version AS new_recommendation_version,
  next.recommended_action_id AS new_action_id,
  next.recommendation_text AS new_recommendation_text,
  next.confidence AS new_confidence,

  (prev.recommended_action_id IS DISTINCT FROM next.recommended_action_id)
    AS action_changed,
  (prev.confidence IS DISTINCT FROM next.confidence)
    AS confidence_changed,
  (rd.capital_impact IS NOT NULL) AS capital_impact_present,
  (rd.gate_impact IS NOT NULL) AS gate_impact_present,

  pc.portfolio_attention_state,
  pc.partner_approval_required,
  pc.partner_consent_status,
  pc.capital_state,
  pc.released_capital_total

FROM qassas_core.recommendation_delta rd
JOIN qassas_core.recommendation prev
  ON prev.recommendation_id = rd.previous_recommendation_id
JOIN qassas_core.recommendation next
  ON next.recommendation_id = rd.new_recommendation_id
JOIN qassas_core.decision_object d
  ON d.decision_id = rd.decision_id
JOIN qassas_core.target t
  ON t.target_id = d.target_id
JOIN qassas_core.pilot_asset_profile p
  ON p.primary_target_id = t.target_id
LEFT JOIN qassas_core.portfolio_control_read_model pc
  ON pc.decision_id = rd.decision_id;

COMMIT;
