BEGIN;

ALTER TABLE qassas_core.evidence_object
  ADD COLUMN IF NOT EXISTS source_org text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS observation text,
  ADD COLUMN IF NOT EXISTS qa_qc_status text,
  ADD COLUMN IF NOT EXISTS created_by_user_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS qassas_core.evidence_qualification (
  qualification_id text PRIMARY KEY,
  evidence_id text NOT NULL REFERENCES qassas_core.evidence_object(evidence_id),
  evidence_object_version bigint NOT NULL,
  assessor_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  validation_status text NOT NULL,
  decision_fitness text NOT NULL,
  confidence_class text NOT NULL,
  limitations text,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_qualification_evidence
  ON qassas_core.evidence_qualification(evidence_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qassas_core.evidence_snapshot (
  snapshot_id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  snapshot_status text NOT NULL CHECK (snapshot_status IN ('LOCKED')),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.evidence_snapshot_item (
  snapshot_id text NOT NULL REFERENCES qassas_core.evidence_snapshot(snapshot_id),
  evidence_id text NOT NULL REFERENCES qassas_core.evidence_object(evidence_id),
  evidence_object_version bigint NOT NULL,
  qualification_id text NOT NULL REFERENCES qassas_core.evidence_qualification(qualification_id),
  validation_status text NOT NULL,
  decision_fitness text NOT NULL,
  confidence_class text NOT NULL,
  PRIMARY KEY (snapshot_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS qassas_core.data_gap (
  gap_id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  decision_id text REFERENCES qassas_core.decision_object(decision_id),
  required_information text NOT NULL,
  why_required text NOT NULL,
  potential_source text,
  cost_class text,
  decision_impact text NOT NULL,
  blocking_status text NOT NULL CHECK (blocking_status IN ('BLOCKING','ADVISORY')),
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_data_gap_target_status
  ON qassas_core.data_gap(target_id, status);

CREATE TABLE IF NOT EXISTS qassas_core.evidence_conflict (
  conflict_id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  decision_id text REFERENCES qassas_core.decision_object(decision_id),
  conflict_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('CF-1','CF-2','CF-3','CF-4','CF-5')),
  technical_interpretation text NOT NULL,
  decision_impact text NOT NULL,
  resolution_method text,
  status text NOT NULL CHECK (
    status IN (
      'OPEN',
      'UNDER_REVIEW',
      'RESOLUTION_TEST_REQUIRED',
      'ACCEPTED_UNCERTAINTY',
      'RESOLVED'
    )
  ),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  object_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS qassas_core.evidence_conflict_item (
  conflict_id text NOT NULL REFERENCES qassas_core.evidence_conflict(conflict_id),
  evidence_id text NOT NULL REFERENCES qassas_core.evidence_object(evidence_id),
  PRIMARY KEY (conflict_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_conflict_target_status
  ON qassas_core.evidence_conflict(target_id, status, severity);

CREATE TABLE IF NOT EXISTS qassas_core.decision_evidence_binding (
  binding_id text PRIMARY KEY,
  decision_id text NOT NULL REFERENCES qassas_core.decision_object(decision_id),
  snapshot_id text NOT NULL REFERENCES qassas_core.evidence_snapshot(snapshot_id),
  decision_object_version bigint NOT NULL,
  bound_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  derived_state text NOT NULL,
  blocking_gap_count integer NOT NULL DEFAULT 0,
  blocking_conflict_count integer NOT NULL DEFAULT 0,
  bound_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_binding_decision
  ON qassas_core.decision_evidence_binding(decision_id, bound_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'decision_object_evidence_snapshot_fk'
  ) THEN
    ALTER TABLE qassas_core.decision_object
      ADD CONSTRAINT decision_object_evidence_snapshot_fk
      FOREIGN KEY (evidence_snapshot_id)
      REFERENCES qassas_core.evidence_snapshot(snapshot_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION qassas_core.deny_locked_evidence_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence snapshots are immutable';
END;
$$;

DROP TRIGGER IF EXISTS evidence_snapshot_no_mutation ON qassas_core.evidence_snapshot;
CREATE TRIGGER evidence_snapshot_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.evidence_snapshot
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_locked_evidence_snapshot_mutation();

DROP TRIGGER IF EXISTS evidence_snapshot_item_no_mutation ON qassas_core.evidence_snapshot_item;
CREATE TRIGGER evidence_snapshot_item_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.evidence_snapshot_item
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_locked_evidence_snapshot_mutation();

COMMIT;
