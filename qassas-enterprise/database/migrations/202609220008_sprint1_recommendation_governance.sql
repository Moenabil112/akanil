BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.candidate_action (
  action_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  action_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  cost_class text NOT NULL,
  estimated_cost_min numeric,
  estimated_cost_max numeric,
  duration_days integer,
  expected_information_gain numeric NOT NULL CHECK (
    expected_information_gain >= 0 AND expected_information_gain <= 1
  ),
  decision_relevance numeric NOT NULL CHECK (
    decision_relevance >= 0 AND decision_relevance <= 1
  ),
  technical_feasibility text NOT NULL,
  constraint_status text NOT NULL CHECK (
    constraint_status IN ('CLEAR','BLOCKED','ESCALATE')
  ),
  status text NOT NULL CHECK (status IN ('ACTIVE','RETIRED')),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_action_decision
  ON qassas_core.candidate_action(decision_id, status);

CREATE TABLE IF NOT EXISTS qassas_core.next_best_test (
  test_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  action_id text REFERENCES qassas_core.candidate_action(action_id),
  test_type text NOT NULL,
  uncertainty_targeted text NOT NULL,
  expected_information_gain numeric NOT NULL CHECK (
    expected_information_gain >= 0 AND expected_information_gain <= 1
  ),
  cost_class text NOT NULL,
  estimated_cost_min numeric,
  estimated_cost_max numeric,
  duration_days integer,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_risk text NOT NULL,
  decision_impact text NOT NULL,
  required_authority text NOT NULL,
  constraint_status text NOT NULL CHECK (
    constraint_status IN ('CLEAR','BLOCKED','ESCALATE')
  ),
  information_gain_per_cost numeric,
  status text NOT NULL CHECK (
    status IN ('PROPOSED','SELECTED','SUPERSEDED','REJECTED')
  ),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_next_best_test_decision
  ON qassas_core.next_best_test(decision_id, status);

CREATE TABLE IF NOT EXISTS qassas_core.recommendation (
  recommendation_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  recommendation_version integer NOT NULL,
  recommendation_type text NOT NULL,
  recommended_test_id text REFERENCES qassas_core.next_best_test(test_id),
  rationale text NOT NULL,
  confidence text NOT NULL CHECK (
    confidence IN ('LOW','MEDIUM','HIGH')
  ),
  trigger_type text NOT NULL,
  model_version text,
  recommendation_status text NOT NULL CHECK (
    recommendation_status IN ('ISSUED','SUPERSEDED')
  ),
  review_status text NOT NULL CHECK (
    review_status IN ('PENDING','ACCEPTED','REJECTED')
  ),
  reviewed_by_user_id text REFERENCES qassas_security.user_identity(user_id),
  reviewer_role_assignment_id text REFERENCES qassas_security.role_assignment(role_assignment_id),
  review_rationale text,
  reviewed_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, recommendation_version)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_decision_current
  ON qassas_core.recommendation(decision_id, recommendation_version DESC);

CREATE TABLE IF NOT EXISTS qassas_core.recommendation_delta (
  delta_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  previous_recommendation_id text NOT NULL REFERENCES qassas_core.recommendation(recommendation_id),
  new_recommendation_id text NOT NULL REFERENCES qassas_core.recommendation(recommendation_id),
  trigger_type text NOT NULL,
  affected_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_test_id text,
  new_test_id text,
  model_version text,
  rationale text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_delta_decision
  ON qassas_core.recommendation_delta(decision_id, created_at);

COMMIT;
