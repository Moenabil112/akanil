BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_reassessment (
  reassessment_id text PRIMARY KEY,
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  asset_id text NOT NULL,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  decision_id text REFERENCES qassas_core.decision_object(decision_id),
  recommendation_delta_id text
    REFERENCES qassas_core.recommendation_delta(delta_id),
  previous_assessment_id text NOT NULL
    REFERENCES qassas_core.target_assessment(assessment_id),
  new_assessment_id text NOT NULL
    REFERENCES qassas_core.target_assessment(assessment_id),
  previous_ppi numeric NOT NULL,
  new_ppi numeric NOT NULL,
  ppi_delta numeric NOT NULL,
  previous_voi_points_per_million_sar numeric NOT NULL,
  new_voi_points_per_million_sar numeric NOT NULL,
  voi_delta numeric NOT NULL,
  trigger_type text NOT NULL,
  rationale text NOT NULL,
  created_by_user_id text NOT NULL
    REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (new_assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_reassessment_asset
  ON qassas_core.portfolio_reassessment(asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_scenario (
  scenario_id text PRIMARY KEY,
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  scenario_name text NOT NULL,
  base_model_code text NOT NULL,
  base_model_version integer NOT NULL,
  w_geological_potential numeric NOT NULL CHECK (w_geological_potential BETWEEN 0 AND 1),
  w_evidence_confidence numeric NOT NULL CHECK (w_evidence_confidence BETWEEN 0 AND 1),
  w_technical_maturity numeric NOT NULL CHECK (w_technical_maturity BETWEEN 0 AND 1),
  w_scale_potential numeric NOT NULL CHECK (w_scale_potential BETWEEN 0 AND 1),
  w_strategic_adjacency numeric NOT NULL CHECK (w_strategic_adjacency BETWEEN 0 AND 1),
  w_cost_to_next_decision numeric NOT NULL CHECK (w_cost_to_next_decision BETWEEN 0 AND 1),
  w_work_commitment_risk numeric NOT NULL CHECK (w_work_commitment_risk BETWEEN 0 AND 1),
  w_partner_constraint numeric NOT NULL CHECK (w_partner_constraint BETWEEN 0 AND 1),
  w_data_quality numeric NOT NULL CHECK (w_data_quality BETWEEN 0 AND 1),
  assessment_refs jsonb NOT NULL,
  authoritative boolean NOT NULL DEFAULT false CHECK (authoritative = false),
  purpose text NOT NULL,
  created_by_user_id text NOT NULL
    REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    w_geological_potential +
    w_evidence_confidence +
    w_technical_maturity +
    w_scale_potential +
    w_strategic_adjacency +
    w_cost_to_next_decision +
    w_work_commitment_risk +
    w_partner_constraint +
    w_data_quality = 1
  )
);

CREATE OR REPLACE FUNCTION qassas_core.deny_portfolio_intelligence_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Portfolio intelligence history records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS portfolio_reassessment_no_mutation
  ON qassas_core.portfolio_reassessment;
CREATE TRIGGER portfolio_reassessment_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.portfolio_reassessment
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_portfolio_intelligence_history_mutation();

DROP TRIGGER IF EXISTS portfolio_scenario_no_mutation
  ON qassas_core.portfolio_scenario;
CREATE TRIGGER portfolio_scenario_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.portfolio_scenario
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_portfolio_intelligence_history_mutation();

COMMIT;
