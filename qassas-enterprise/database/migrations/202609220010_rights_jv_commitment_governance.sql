BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.licence_register (
  licence_id text PRIMARY KEY,
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  licence_number text NOT NULL,
  licence_type text NOT NULL,
  licence_status text NOT NULL CHECK (
    licence_status IN ('ACTIVE','SUSPENDED','EXPIRED','TRANSFER_PENDING')
  ),
  issue_date date,
  expiry_date date,
  transfer_status text,
  validation_status text NOT NULL CHECK (
    validation_status IN ('UNVERIFIED','VALIDATED','CONFLICTED')
  ),
  source_instrument text,
  security_class text NOT NULL DEFAULT 'C3_COMMERCIAL_JV_RESTRICTED',
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enterprise_id, licence_number)
);

CREATE TABLE IF NOT EXISTS qassas_core.licence_party_role (
  party_role_id text PRIMARY KEY,
  licence_id text NOT NULL REFERENCES qassas_core.licence_register(licence_id),
  party_name text NOT NULL,
  role_type text NOT NULL CHECK (
    role_type IN (
      'LEGAL_HOLDER',
      'OPERATOR',
      'BENEFICIAL_INTEREST',
      'ECONOMIC_INTEREST',
      'FUNDING_PARTY',
      'JV_PARTNER',
      'DATA_RIGHTS_HOLDER'
    )
  ),
  economic_interest_percentage numeric CHECK (
    economic_interest_percentage IS NULL OR
    (
      economic_interest_percentage >= 0 AND
      economic_interest_percentage <= 100
    )
  ),
  source_instrument text,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licence_party_role
  ON qassas_core.licence_party_role(licence_id, role_type);

CREATE TABLE IF NOT EXISTS qassas_core.jv_constraint (
  constraint_id text PRIMARY KEY,
  jv_id text NOT NULL,
  licence_id text NOT NULL REFERENCES qassas_core.licence_register(licence_id),
  decision_class text,
  partner_name text NOT NULL,
  reserved_matter text NOT NULL,
  consent_required boolean NOT NULL DEFAULT true,
  voting_threshold text,
  source_instrument text,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jv_id, licence_id, reserved_matter)
);

CREATE INDEX IF NOT EXISTS idx_jv_constraint_licence
  ON qassas_core.jv_constraint(licence_id, decision_class);

CREATE TABLE IF NOT EXISTS qassas_core.jv_consent_event (
  consent_event_id text PRIMARY KEY,
  constraint_id text NOT NULL REFERENCES qassas_core.jv_constraint(constraint_id),
  consent_status text NOT NULL CHECK (
    consent_status IN ('PENDING','APPROVED','REJECTED','EXPIRED')
  ),
  effective_until timestamptz,
  rationale text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jv_consent_event_constraint
  ON qassas_core.jv_consent_event(constraint_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS qassas_core.work_commitment (
  commitment_id text PRIMARY KEY,
  licence_id text NOT NULL REFERENCES qassas_core.licence_register(licence_id),
  description text NOT NULL,
  due_date date NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  cost_class text CHECK (
    cost_class IS NULL OR cost_class IN ('C0','C1','C2','C3','C4','C5')
  ),
  status text NOT NULL CHECK (
    status IN ('OPEN','SATISFIED','WAIVED','OVERDUE')
  ),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_commitment_licence_due
  ON qassas_core.work_commitment(licence_id, status, due_date);

CREATE TABLE IF NOT EXISTS qassas_core.decision_constraint_assessment (
  assessment_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  licence_id text NOT NULL REFERENCES qassas_core.licence_register(licence_id),
  technical_state text NOT NULL,
  derived_decision_state text NOT NULL,
  licence_validation_status text NOT NULL,
  partner_approval_required boolean NOT NULL,
  partner_consent_status text,
  work_commitment_risk text,
  commitment_at_risk boolean NOT NULL DEFAULT false,
  licence_at_risk boolean NOT NULL DEFAULT false,
  execution_allowed boolean NOT NULL DEFAULT false,
  portfolio_optimisation_allowed boolean NOT NULL DEFAULT false,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_constraint_assessment
  ON qassas_core.decision_constraint_assessment(decision_id, created_at DESC);

CREATE OR REPLACE FUNCTION qassas_core.deny_rights_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Rights and constraint history records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS licence_party_role_no_mutation
  ON qassas_core.licence_party_role;
CREATE TRIGGER licence_party_role_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.licence_party_role
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_rights_history_mutation();

DROP TRIGGER IF EXISTS jv_constraint_no_mutation
  ON qassas_core.jv_constraint;
CREATE TRIGGER jv_constraint_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.jv_constraint
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_rights_history_mutation();

DROP TRIGGER IF EXISTS jv_consent_event_no_mutation
  ON qassas_core.jv_consent_event;
CREATE TRIGGER jv_consent_event_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.jv_consent_event
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_rights_history_mutation();

DROP TRIGGER IF EXISTS constraint_assessment_no_mutation
  ON qassas_core.decision_constraint_assessment;
CREATE TRIGGER constraint_assessment_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.decision_constraint_assessment
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_rights_history_mutation();

COMMIT;
