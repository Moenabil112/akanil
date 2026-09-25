BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.public_source_snapshot (
  snapshot_id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  adapter_id text NOT NULL REFERENCES qassas_core.source_adapter_contract(adapter_id),
  source_object_id text NOT NULL,
  source_url text NOT NULL,
  parser_version text NOT NULL,
  source_updated_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  http_status integer NOT NULL CHECK (http_status >= 100 AND http_status <= 599),
  raw_payload_hash text NOT NULL,
  normalized_payload_hash text,
  normalized_payload jsonb,
  validation_status text NOT NULL CHECK (
    validation_status IN ('ACCEPTED','QUARANTINED')
  ),
  quarantine_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (validation_status = 'ACCEPTED'
      AND normalized_payload_hash IS NOT NULL
      AND normalized_payload IS NOT NULL
      AND quarantine_reason IS NULL)
    OR
    (validation_status = 'QUARANTINED'
      AND quarantine_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_public_source_snapshot_lookup
  ON qassas_core.public_source_snapshot(
    portfolio_id, source_id, source_object_id, created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_public_source_snapshot_validation
  ON qassas_core.public_source_snapshot(
    adapter_id, validation_status, created_at DESC
  );

DROP TRIGGER IF EXISTS public_source_snapshot_no_update
  ON qassas_core.public_source_snapshot;
CREATE TRIGGER public_source_snapshot_no_update
BEFORE UPDATE OR DELETE ON qassas_core.public_source_snapshot
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE TABLE IF NOT EXISTS qassas_core.public_source_change_event (
  change_event_id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  adapter_id text NOT NULL REFERENCES qassas_core.source_adapter_contract(adapter_id),
  source_object_id text NOT NULL,
  snapshot_id text NOT NULL REFERENCES qassas_core.public_source_snapshot(snapshot_id),
  previous_snapshot_id text REFERENCES qassas_core.public_source_snapshot(snapshot_id),
  change_type text NOT NULL CHECK (
    change_type IN ('FIRST_SEEN','CHANGED','UNCHANGED','QUARANTINED')
  ),
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_source_change_event_portfolio
  ON qassas_core.public_source_change_event(
    portfolio_id, source_id, created_at DESC
  );

DROP TRIGGER IF EXISTS public_source_change_event_no_update
  ON qassas_core.public_source_change_event;
CREATE TRIGGER public_source_change_event_no_update
BEFORE UPDATE OR DELETE ON qassas_core.public_source_change_event
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE TABLE IF NOT EXISTS qassas_core.source_adapter_runtime_state (
  adapter_id text PRIMARY KEY REFERENCES qassas_core.source_adapter_contract(adapter_id),
  runtime_status text NOT NULL CHECK (
    runtime_status IN ('NEVER_RUN','HEALTHY','DEGRADED','SCHEMA_DRIFT','UNREACHABLE')
  ),
  last_run_id text REFERENCES qassas_core.source_ingestion_run(ingestion_run_id),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_seen_source_updated_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error_code text,
  last_error_summary text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE qassas_core.source_adapter_contract
SET configuration = configuration || '{"parser_version":"TAADEN_HTML_V1","production_host":"taadeen.sa","http_timeout_ms_default":10000,"max_payload_bytes_default":2000000,"schema_drift_policy":"QUARANTINE","automated_target_creation":false}'::jsonb,
    updated_at = now()
WHERE adapter_id = 'ADP-TAADEN-LICENCE-PAGE';

INSERT INTO qassas_core.source_adapter_runtime_state (
  adapter_id, runtime_status
)
SELECT adapter_id, 'NEVER_RUN'
FROM qassas_core.source_adapter_contract
WHERE adapter_id IN ('ADP-TAADEN-LICENCE-PAGE','ADP-TAADEN-INVESTOR-PAGE')
ON CONFLICT (adapter_id) DO NOTHING;

CREATE OR REPLACE VIEW qassas_core.taadeen_portfolio_sync_status AS
SELECT
  p.portfolio_id,
  p.institution_id,
  p.enterprise_id,
  count(a.asset_id) FILTER (
    WHERE a.source_of_record_id = 'SRC-TAADEN'
      AND a.master_data_status <> 'ARCHIVED'
  )::int AS taadeen_asset_count,
  max(a.public_data_last_seen_at) FILTER (
    WHERE a.source_of_record_id = 'SRC-TAADEN'
      AND a.master_data_status <> 'ARCHIVED'
  ) AS latest_asset_seen_at,
  latest_run.ingestion_run_id AS latest_run_id,
  latest_run.status AS latest_run_status,
  latest_run.started_at AS latest_run_started_at,
  latest_run.completed_at AS latest_run_completed_at,
  latest_run.record_count AS latest_record_count,
  latest_run.accepted_count AS latest_accepted_count,
  latest_run.rejected_count AS latest_rejected_count,
  runtime.runtime_status AS adapter_runtime_status,
  runtime.last_attempt_at,
  runtime.last_success_at,
  runtime.last_failure_at,
  runtime.consecutive_failures,
  runtime.last_error_code,
  runtime.last_error_summary
FROM qassas_core.institution_portfolio p
LEFT JOIN qassas_core.portfolio_asset_registry a
  ON a.portfolio_id = p.portfolio_id
LEFT JOIN LATERAL (
  SELECT r.ingestion_run_id, r.status, r.started_at, r.completed_at,
         r.record_count, r.accepted_count, r.rejected_count
  FROM qassas_core.source_ingestion_run r
  WHERE r.portfolio_id = p.portfolio_id
    AND r.source_id = 'SRC-TAADEN'
  ORDER BY r.started_at DESC, r.ingestion_run_id DESC
  LIMIT 1
) latest_run ON true
LEFT JOIN qassas_core.source_adapter_runtime_state runtime
  ON runtime.adapter_id = 'ADP-TAADEN-LICENCE-PAGE'
GROUP BY
  p.portfolio_id,
  p.institution_id,
  p.enterprise_id,
  latest_run.ingestion_run_id,
  latest_run.status,
  latest_run.started_at,
  latest_run.completed_at,
  latest_run.record_count,
  latest_run.accepted_count,
  latest_run.rejected_count,
  runtime.runtime_status,
  runtime.last_attempt_at,
  runtime.last_success_at,
  runtime.last_failure_at,
  runtime.consecutive_failures,
  runtime.last_error_code,
  runtime.last_error_summary;

COMMIT;
