BEGIN;

ALTER TABLE qassas_outbox.outbox_event
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token text;

CREATE INDEX IF NOT EXISTS idx_outbox_claimable
  ON qassas_outbox.outbox_event (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS qassas_outbox.consumer_delivery (
  consumer_name text NOT NULL,
  outbox_event_id text NOT NULL REFERENCES qassas_outbox.outbox_event(outbox_event_id),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, outbox_event_id)
);

CREATE TABLE IF NOT EXISTS qassas_core.decision_read_model (
  decision_id text PRIMARY KEY,
  state text,
  object_version bigint NOT NULL DEFAULT 0,
  last_event_type text NOT NULL,
  correlation_id text NOT NULL,
  last_event_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
