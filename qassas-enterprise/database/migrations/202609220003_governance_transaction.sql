BEGIN;

ALTER TABLE qassas_core.decision_object
  ADD COLUMN IF NOT EXISTS created_by_user_id text;

ALTER TABLE qassas_audit.audit_event
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS qassas_core.command_idempotency (
  actor_id text NOT NULL,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, command_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_decision_target
  ON qassas_core.decision_object(target_id);

CREATE INDEX IF NOT EXISTS idx_human_review_decision
  ON qassas_core.human_review(decision_id, started_at DESC);

COMMIT;
