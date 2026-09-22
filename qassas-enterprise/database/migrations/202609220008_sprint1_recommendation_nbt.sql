BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.candidate_action (
  candidate_action_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  action_code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  cost_class text CHECK (cost_class IS NULL OR cost_class IN ('C0','C1','C2','C3','C4','C5')),
  technical_risk text,
  partner_dependency boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_action_decision
  ON qassas_core.candidate_action(decision_id, created_at);

CREATE TABLE IF NOT EXISTS qassas_core.next_best_test (
  test_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  candidate_action_id text REFERENCES qassas_core.candidate_action(candidate_action_id),
  test_type text NOT NULL,
  uncertainty_targeted text NOT NULL,
  expected_information_gain text NOT NULL CHECK (
    expected_information_gain IN ('LOW','MEDIUM','HIGH','VERY_HIGH')
  ),
  cost_class text NOT NULL CHECK (cost_class IN ('C0','C1','C2','C3','C4','C5')),
  cost_range_min numeric,
  cost_range_max numeric,
  time_range text,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_risk text,
  decision_impact text NOT NULL,
  required_authority text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROPOSED')),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    cost_range_min IS NULL OR
    cost_range_max IS NULL OR
    cost_range_max >= cost_range_min
  )
);

CREATE INDEX IF NOT EXISTS idx_next_best_test_decision
  ON qassas_core.next_best_test(decision_id, created_at);

CREATE TABLE IF NOT EXISTS qassas_core.recommendation (
  recommendation_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  recommendation_version integer NOT NULL,
  evidence_snapshot_id text NOT NULL REFERENCES qassas_core.evidence_snapshot(snapshot_id),
  recommended_action_id text NOT NULL REFERENCES qassas_core.candidate_action(candidate_action_id),
  recommendation_text text NOT NULL,
  rationale text NOT NULL,
  confidence text NOT NULL CHECK (
    confidence IN ('LOW','MEDIUM','HIGH','VERY_HIGH')
  ),
  recommender_type text NOT NULL CHECK (
    recommender_type IN ('HUMAN','SYSTEM_RULE')
  ),
  model_version text,
  supersedes_recommendation_id text REFERENCES qassas_core.recommendation(recommendation_id),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, recommendation_version)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision
  ON qassas_core.recommendation(decision_id, recommendation_version DESC);

CREATE TABLE IF NOT EXISTS qassas_core.recommendation_delta (
  delta_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  previous_recommendation_id text NOT NULL REFERENCES qassas_core.recommendation(recommendation_id),
  new_recommendation_id text NOT NULL REFERENCES qassas_core.recommendation(recommendation_id),
  trigger_type text NOT NULL,
  trigger_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text NOT NULL,
  capital_impact text,
  gate_impact text,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (new_recommendation_id)
);

CREATE OR REPLACE FUNCTION qassas_core.deny_decision_intelligence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Decision intelligence records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS candidate_action_no_mutation ON qassas_core.candidate_action;
CREATE TRIGGER candidate_action_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.candidate_action
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

DROP TRIGGER IF EXISTS next_best_test_no_mutation ON qassas_core.next_best_test;
CREATE TRIGGER next_best_test_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.next_best_test
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

DROP TRIGGER IF EXISTS recommendation_no_mutation ON qassas_core.recommendation;
CREATE TRIGGER recommendation_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.recommendation
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

DROP TRIGGER IF EXISTS recommendation_delta_no_mutation ON qassas_core.recommendation_delta;
CREATE TRIGGER recommendation_delta_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.recommendation_delta
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

COMMIT;
