BEGIN;

ALTER TABLE qassas_core.human_review
  ADD COLUMN IF NOT EXISTS workflow_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_human_review_workflow_id
  ON qassas_core.human_review(workflow_id)
  WHERE workflow_id IS NOT NULL;

COMMIT;
