BEGIN;

ALTER TABLE qassas_core.target
  ADD COLUMN IF NOT EXISTS asset_id text,
  ADD COLUMN IF NOT EXISTS security_class text NOT NULL DEFAULT 'C1_INTERNAL';

CREATE INDEX IF NOT EXISTS idx_target_asset_id
  ON qassas_core.target(asset_id);

COMMIT;
