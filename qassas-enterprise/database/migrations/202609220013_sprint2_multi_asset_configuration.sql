BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.workflow_template (
  template_code text PRIMARY KEY,
  template_name text NOT NULL,
  decision_class text NOT NULL,
  initial_gate text NOT NULL,
  required_evidence_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_reviewer_role text NOT NULL,
  rule_set_version text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.pilot_asset_profile (
  profile_id text PRIMARY KEY,
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  asset_id text NOT NULL UNIQUE,
  asset_name text NOT NULL,
  decision_object_key text NOT NULL UNIQUE,
  decision_class text NOT NULL,
  configured_gate text NOT NULL,
  workflow_template_code text NOT NULL
    REFERENCES qassas_core.workflow_template(template_code),
  primary_target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  secondary_target_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL,
  security_class text NOT NULL,
  pilot_status text NOT NULL CHECK (
    pilot_status IN ('CONFIGURED','ACTIVE','HOLD','CLOSED')
  ),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_asset_profile_order
  ON qassas_core.pilot_asset_profile(enterprise_id, display_order);

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
  pc.partner_approval_required,
  pc.partner_consent_status,
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
