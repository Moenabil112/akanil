BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS qassas_core;
CREATE SCHEMA IF NOT EXISTS qassas_security;
CREATE SCHEMA IF NOT EXISTS qassas_audit;
CREATE SCHEMA IF NOT EXISTS qassas_outbox;

CREATE TABLE IF NOT EXISTS qassas_core.enterprise (
  enterprise_id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_security.user_identity (
  user_id text PRIMARY KEY,
  external_subject text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_security.role_assignment (
  role_assignment_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  role_type text NOT NULL,
  asset_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  jv_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_class_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  capital_threshold numeric,
  security_clearance text NOT NULL DEFAULT 'C1_INTERNAL',
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  status text NOT NULL CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','EXPIRED','REVOKED')),
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qassas_core.target (
  target_id text PRIMARY KEY,
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  prospect_id text,
  name text NOT NULL,
  current_gate text NOT NULL,
  operational_state text NOT NULL,
  target_status text NOT NULL,
  geometry geometry(Geometry, 4326),
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.evidence_object (
  evidence_id text PRIMARY KEY,
  target_id text REFERENCES qassas_core.target(target_id),
  evidence_class text NOT NULL,
  source_system text NOT NULL,
  source_object_id text,
  source_date timestamptz,
  version_label text,
  validation_status text NOT NULL,
  decision_fitness text NOT NULL,
  security_class text NOT NULL,
  current_state text NOT NULL,
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.decision_object (
  decision_id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  decision_class text NOT NULL,
  decision_question text NOT NULL,
  current_gate text NOT NULL,
  trigger_type text NOT NULL,
  state text NOT NULL,
  decision_version bigint NOT NULL DEFAULT 1,
  object_version bigint NOT NULL DEFAULT 1,
  evidence_snapshot_id text,
  final_decision text,
  final_rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.human_review (
  review_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  required_role text NOT NULL,
  reviewer_user_id text REFERENCES qassas_security.user_identity(user_id),
  reviewer_role_assignment_id text REFERENCES qassas_security.role_assignment(role_assignment_id),
  review_status text NOT NULL,
  review_decision text,
  rationale text,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  object_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS qassas_audit.audit_event (
  audit_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  object_version bigint,
  actor_id text,
  actor_role text,
  tenant_id text NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  previous_state text,
  new_state text,
  payload_hash text NOT NULL,
  previous_event_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION qassas_audit.deny_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_event_no_update ON qassas_audit.audit_event;
CREATE TRIGGER audit_event_no_update
BEFORE UPDATE OR DELETE ON qassas_audit.audit_event
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE TABLE IF NOT EXISTS qassas_outbox.outbox_event (
  outbox_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL,
  payload jsonb NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
  ON qassas_outbox.outbox_event (created_at)
  WHERE published_at IS NULL;

COMMIT;
