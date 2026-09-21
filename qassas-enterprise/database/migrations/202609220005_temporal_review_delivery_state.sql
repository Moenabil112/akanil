BEGIN;

ALTER TABLE qassas_core.human_review
  ADD COLUMN IF NOT EXISTS workflow_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_signal_sent_at timestamptz;

COMMIT;
