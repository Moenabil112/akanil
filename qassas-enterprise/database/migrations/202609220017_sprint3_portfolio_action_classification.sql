BEGIN;

CREATE OR REPLACE VIEW qassas_core.portfolio_action_classification_latest AS
SELECT
  pi.*,

  'PAC-0.1'::text AS action_model_version,

  CASE
    WHEN pi.partner_approval_required IS TRUE
      OR (
        pi.partner_consent_status IS NOT NULL
        AND pi.partner_consent_status NOT IN ('APPROVED','NOT_REQUIRED')
      )
      THEN 'JV_GOVERNED'

    WHEN pi.capital_type = 'PARTNER_CAPITAL'
      THEN 'PARTNER_CAPITAL'

    WHEN pi.decision_class = 'COVERED_TARGET_TEST'
      THEN 'SELECTIVE_VALIDATION'

    WHEN pi.decision_class = 'MULTI_TARGET_PORTFOLIO'
      AND COALESCE(pi.partner_approval_required, false) IS FALSE
      THEN 'TARGET_GENERATION'

    WHEN pi.priority_index >= 75
      AND COALESCE(pi.execution_allowed, false) IS TRUE
      AND COALESCE(pi.blocking_gap_count, 0) = 0
      AND COALESCE(pi.blocking_conflict_count, 0) = 0
      AND COALESCE(pi.commitment_at_risk, false) IS FALSE
      AND COALESCE(pi.licence_at_risk, false) IS FALSE
      THEN 'ACCELERATE'

    WHEN pi.priority_index >= 65
      AND pi.capital_request_id IS NOT NULL
      AND pi.capital_state IN ('APPROVED','CONDITIONALLY_APPROVED','RESERVED')
      THEN 'FUND'

    WHEN pi.priority_index < 55
      AND pi.voi_points_per_million_sar < 20
      THEN 'HOLD_DROP_FARM_OUT'

    ELSE 'SELECTIVE_VALIDATION'
  END AS advisory_action_class,

  CASE
    WHEN pi.partner_approval_required IS TRUE
      OR (
        pi.partner_consent_status IS NOT NULL
        AND pi.partner_consent_status NOT IN ('APPROVED','NOT_REQUIRED')
      )
      THEN 'Partner/JV control is material; technical priority cannot bypass consent.'

    WHEN pi.capital_type = 'PARTNER_CAPITAL'
      THEN 'Current capital path is explicitly partner-funded.'

    WHEN pi.decision_class = 'COVERED_TARGET_TEST'
      THEN 'Early covered target requires selective validation before drilling.'

    WHEN pi.decision_class = 'MULTI_TARGET_PORTFOLIO'
      AND COALESCE(pi.partner_approval_required, false) IS FALSE
      THEN 'Portfolio remains in target-generation/prioritisation mode.'

    WHEN pi.priority_index >= 75
      AND COALESCE(pi.execution_allowed, false) IS TRUE
      AND COALESCE(pi.blocking_gap_count, 0) = 0
      AND COALESCE(pi.blocking_conflict_count, 0) = 0
      AND COALESCE(pi.commitment_at_risk, false) IS FALSE
      AND COALESCE(pi.licence_at_risk, false) IS FALSE
      THEN 'High portfolio priority with no current governance blocker.'

    WHEN pi.priority_index >= 65
      AND pi.capital_request_id IS NOT NULL
      AND pi.capital_state IN ('APPROVED','CONDITIONALLY_APPROVED','RESERVED')
      THEN 'Material priority with governed capital path already established.'

    WHEN pi.priority_index < 55
      AND pi.voi_points_per_million_sar < 20
      THEN 'Low relative priority and low information leverage.'

    ELSE 'Additional bounded evidence is preferable before larger capital commitment.'
  END AS action_rationale,

  jsonb_build_object(
    'priority_index', pi.priority_index,
    'voi_points_per_million_sar', pi.voi_points_per_million_sar,
    'decision_class', pi.decision_class,
    'configured_gate', pi.configured_gate,
    'execution_allowed', pi.execution_allowed,
    'blocking_gap_count', COALESCE(pi.blocking_gap_count, 0),
    'blocking_conflict_count', COALESCE(pi.blocking_conflict_count, 0),
    'partner_approval_required', pi.partner_approval_required,
    'partner_consent_status', pi.partner_consent_status,
    'work_commitment_risk', pi.work_commitment_risk,
    'commitment_at_risk', pi.commitment_at_risk,
    'licence_at_risk', pi.licence_at_risk,
    'capital_type', pi.capital_type,
    'capital_state', pi.capital_state
  ) AS action_input_snapshot

FROM qassas_core.portfolio_intelligence_latest pi;

COMMIT;
