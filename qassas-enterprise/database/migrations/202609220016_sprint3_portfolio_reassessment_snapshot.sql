BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_reassessment_snapshot (
  snapshot_id text PRIMARY KEY,
  enterprise_id text NOT NULL
    REFERENCES qassas_core.enterprise(enterprise_id),
  model_version text,
  trigger_type text NOT NULL,
  source_event_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_count integer NOT NULL CHECK (asset_count >= 0),
  portfolio_state_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by_user_id text NOT NULL
    REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_reassessment_created
  ON qassas_core.portfolio_reassessment_snapshot(
    enterprise_id, created_at DESC
  );

DROP TRIGGER IF EXISTS portfolio_reassessment_snapshot_no_mutation
  ON qassas_core.portfolio_reassessment_snapshot;

CREATE TRIGGER portfolio_reassessment_snapshot_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.portfolio_reassessment_snapshot
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

COMMIT;
