BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.capital_request (
  capital_request_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  capital_type text NOT NULL CHECK (
    capital_type IN ('DECISION_CAPITAL','EXECUTION_CAPITAL')
  ),
  requested_amount numeric NOT NULL CHECK (requested_amount > 0),
  currency text NOT NULL,
  purpose text NOT NULL,
  funding_source text,
  state text NOT NULL CHECK (
    state IN (
      'REQUESTED',
      'GATES_ASSESSED',
      'BLOCKED',
      'APPROVED',
      'RELEASED',
      'RETURNED'
    )
  ),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_request_decision
  ON qassas_core.capital_request(decision_id, created_at);

CREATE TABLE IF NOT EXISTS qassas_core.capital_gate_assessment (
  assessment_id text PRIMARY KEY,
  capital_request_id text NOT NULL
    REFERENCES qassas_core.capital_request(capital_request_id),
  request_object_version bigint NOT NULL,
  evidence_gate boolean NOT NULL,
  technical_gate boolean NOT NULL,
  rights_gate boolean NOT NULL,
  jv_gate boolean NOT NULL,
  recommendation_gate boolean NOT NULL,
  authority_gate boolean NOT NULL,
  programme_readiness_gate boolean NOT NULL,
  all_required_gates_pass boolean NOT NULL,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessed_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_gate_request
  ON qassas_core.capital_gate_assessment(capital_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qassas_core.capital_approval (
  approval_id text PRIMARY KEY,
  capital_request_id text NOT NULL
    REFERENCES qassas_core.capital_request(capital_request_id),
  approved_amount numeric NOT NULL CHECK (approved_amount > 0),
  currency text NOT NULL,
  approver_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  approver_role_assignment_id text NOT NULL
    REFERENCES qassas_security.role_assignment(role_assignment_id),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capital_request_id)
);

CREATE TABLE IF NOT EXISTS qassas_core.capital_release (
  release_id text PRIMARY KEY,
  capital_request_id text NOT NULL
    REFERENCES qassas_core.capital_request(capital_request_id),
  approval_id text NOT NULL REFERENCES qassas_core.capital_approval(approval_id),
  released_amount numeric NOT NULL CHECK (released_amount > 0),
  currency text NOT NULL,
  released_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  released_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capital_request_id)
);

CREATE TABLE IF NOT EXISTS qassas_core.capital_return (
  return_id text PRIMARY KEY,
  capital_request_id text NOT NULL
    REFERENCES qassas_core.capital_request(capital_request_id),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  reason text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION qassas_core.deny_capital_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Capital governance history records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS capital_gate_assessment_no_mutation
  ON qassas_core.capital_gate_assessment;
CREATE TRIGGER capital_gate_assessment_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.capital_gate_assessment
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_capital_history_mutation();

DROP TRIGGER IF EXISTS capital_approval_no_mutation
  ON qassas_core.capital_approval;
CREATE TRIGGER capital_approval_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.capital_approval
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_capital_history_mutation();

DROP TRIGGER IF EXISTS capital_release_no_mutation
  ON qassas_core.capital_release;
CREATE TRIGGER capital_release_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.capital_release
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_capital_history_mutation();

DROP TRIGGER IF EXISTS capital_return_no_mutation
  ON qassas_core.capital_return;
CREATE TRIGGER capital_return_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.capital_return
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_capital_history_mutation();

COMMIT;
