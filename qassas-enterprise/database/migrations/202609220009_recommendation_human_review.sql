BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.recommendation_review (
  review_id text PRIMARY KEY,
  recommendation_id text NOT NULL UNIQUE
    REFERENCES qassas_core.recommendation(recommendation_id),
  decision_id text NOT NULL
    REFERENCES qassas_core.decision_object(decision_id),
  review_status text NOT NULL CHECK (
    review_status IN ('ACCEPTED','REJECTED')
  ),
  reviewer_user_id text NOT NULL
    REFERENCES qassas_security.user_identity(user_id),
  reviewer_role_assignment_id text NOT NULL
    REFERENCES qassas_security.role_assignment(role_assignment_id),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_review_decision
  ON qassas_core.recommendation_review(decision_id, created_at);

COMMIT;
