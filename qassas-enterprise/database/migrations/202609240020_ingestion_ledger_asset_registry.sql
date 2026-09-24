BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.source_adapter_contract (
  adapter_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  adapter_kind text NOT NULL CHECK (
    adapter_kind IN (
      'OGC_CATALOG',
      'OGC_WFS',
      'OGC_WMS',
      'OGC_WCS',
      'PUBLIC_RECORD_PAGE',
      'CONTROLLED_EXPORT',
      'PARTNER_DATA_ROOM'
    )
  ),
  endpoint_class text NOT NULL CHECK (
    endpoint_class IN ('PUBLIC_URL','ENV_REFERENCE','CONTRACTUAL_ENDPOINT')
  ),
  endpoint_value text,
  content_format text NOT NULL,
  adapter_status text NOT NULL CHECK (
    adapter_status IN (
      'DISCOVERY_REQUIRED',
      'CONFIG_REQUIRED',
      'AVAILABLE_READ_ONLY',
      'TERM_SHEET_REQUIRED',
      'CONNECTED',
      'SUSPENDED'
    )
  ),
  refresh_policy text NOT NULL DEFAULT 'ON_DEMAND',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_adapter_contract_source
  ON qassas_core.source_adapter_contract(source_id, adapter_status);

CREATE TABLE IF NOT EXISTS qassas_core.source_ingestion_run (
  ingestion_run_id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('SCHEDULED','MANUAL','SOURCE_CHANGE','PARTNER_DELIVERY')
  ),
  source_snapshot_ref text,
  requested_by_user_id text REFERENCES qassas_security.user_identity(user_id),
  correlation_id text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('STARTED','COMPLETED','FAILED','CANCELLED')
  ),
  record_count integer NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  content_manifest_hash text,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_source_ingestion_run_portfolio
  ON qassas_core.source_ingestion_run(portfolio_id, source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS qassas_core.source_ingestion_record (
  ingestion_record_id text PRIMARY KEY,
  ingestion_run_id text NOT NULL REFERENCES qassas_core.source_ingestion_run(ingestion_run_id),
  source_object_id text NOT NULL,
  source_object_type text NOT NULL,
  source_version text,
  source_updated_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  payload_hash text NOT NULL,
  normalized_object_type text,
  normalized_object_id text,
  validation_status text NOT NULL CHECK (
    validation_status IN ('RECEIVED','NORMALIZED','ACCEPTED','QUARANTINED','REJECTED')
  ),
  security_class text NOT NULL DEFAULT 'C0_PUBLIC',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingestion_run_id, source_object_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_source_ingestion_record_source_object
  ON qassas_core.source_ingestion_record(source_object_id, created_at DESC);

DROP TRIGGER IF EXISTS source_ingestion_record_no_update
  ON qassas_core.source_ingestion_record;
CREATE TRIGGER source_ingestion_record_no_update
BEFORE UPDATE OR DELETE ON qassas_core.source_ingestion_record
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_asset_registry (
  asset_id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  asset_name text NOT NULL,
  asset_type text NOT NULL CHECK (
    asset_type IN (
      'RECONNAISSANCE_LICENCE',
      'EXPLORATION_LICENCE',
      'EXPLOITATION_LICENCE',
      'MINING_LICENCE',
      'PROJECT',
      'PROSPECT',
      'MINERAL_OCCURRENCE',
      'UNKNOWN'
    )
  ),
  external_licence_number text,
  region text,
  area_km2 numeric CHECK (area_km2 IS NULL OR area_km2 >= 0),
  geometry geometry(Geometry, 4326),
  mineral_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_of_record_id text REFERENCES qassas_core.data_source_registry(source_id),
  source_object_id text,
  master_data_status text NOT NULL CHECK (
    master_data_status IN ('DISCOVERED','PUBLIC_VERIFIED','PARTNER_CONFIRMED','ARCHIVED')
  ),
  security_class text NOT NULL DEFAULT 'C0_PUBLIC',
  public_data_last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, source_of_record_id, source_object_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_asset_registry_portfolio
  ON qassas_core.portfolio_asset_registry(portfolio_id, master_data_status);

CREATE INDEX IF NOT EXISTS idx_portfolio_asset_registry_geometry
  ON qassas_core.portfolio_asset_registry USING gist(geometry);

CREATE TABLE IF NOT EXISTS qassas_core.asset_source_identity (
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  source_object_id text NOT NULL,
  asset_id text NOT NULL REFERENCES qassas_core.portfolio_asset_registry(asset_id),
  match_method text NOT NULL CHECK (
    match_method IN ('EXACT_PUBLIC_ID','LICENCE_NUMBER','SPATIAL_MATCH','HUMAN_CONFIRMED')
  ),
  identity_confidence numeric NOT NULL CHECK (identity_confidence >= 0 AND identity_confidence <= 1),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_object_id)
);

CREATE OR REPLACE FUNCTION qassas_core.enforce_ingestion_source_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_class text;
  v_access_status text;
BEGIN
  SELECT r.source_class, s.access_status
    INTO v_source_class, v_access_status
    FROM qassas_core.portfolio_data_source s
    JOIN qassas_core.data_source_registry r
      ON r.source_id = s.source_id
   WHERE s.portfolio_id = NEW.portfolio_id
     AND s.source_id = NEW.source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source % is not registered for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  IF v_source_class = 'PRIVATE_CONTRACTUAL'
     AND v_access_status <> 'CONNECTED' THEN
    RAISE EXCEPTION 'Private source % requires connected contractual access for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  IF v_source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY')
     AND v_access_status NOT IN ('AVAILABLE','CONNECTED') THEN
    RAISE EXCEPTION 'Public source % is not available for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_ingestion_run_access_gate
  ON qassas_core.source_ingestion_run;
CREATE TRIGGER source_ingestion_run_access_gate
BEFORE INSERT ON qassas_core.source_ingestion_run
FOR EACH ROW EXECUTE FUNCTION qassas_core.enforce_ingestion_source_access();

CREATE OR REPLACE VIEW qassas_security.institution_member_enterprise_scope AS
SELECT DISTINCT
  m.user_id,
  m.institution_id,
  i.enterprise_id,
  m.institution_role,
  m.status,
  m.effective_from,
  m.effective_to
FROM qassas_security.institution_membership m
JOIN qassas_core.institution i
  ON i.institution_id = m.institution_id
WHERE m.status = 'ACTIVE'
  AND m.effective_from <= now()
  AND (m.effective_to IS NULL OR m.effective_to > now());

CREATE OR REPLACE VIEW qassas_core.portfolio_data_pipeline_status AS
SELECT
  p.portfolio_id,
  p.institution_id,
  p.enterprise_id,
  s.source_id,
  r.source_name,
  r.source_authority,
  r.source_class,
  s.access_basis,
  s.access_status,
  r.connector_status,
  COALESCE(a.adapter_count, 0) AS adapter_count,
  a.adapter_states,
  latest.ingestion_run_id AS latest_ingestion_run_id,
  latest.status AS latest_ingestion_status,
  latest.started_at AS latest_ingestion_started_at,
  latest.completed_at AS latest_ingestion_completed_at,
  latest.record_count AS latest_record_count,
  latest.accepted_count AS latest_accepted_count,
  latest.rejected_count AS latest_rejected_count
FROM qassas_core.institution_portfolio p
JOIN qassas_core.portfolio_data_source s
  ON s.portfolio_id = p.portfolio_id
JOIN qassas_core.data_source_registry r
  ON r.source_id = s.source_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS adapter_count,
    jsonb_agg(
      jsonb_build_object(
        'adapter_id', c.adapter_id,
        'adapter_kind', c.adapter_kind,
        'status', c.adapter_status,
        'refresh_policy', c.refresh_policy
      )
      ORDER BY c.adapter_id
    ) AS adapter_states
  FROM qassas_core.source_adapter_contract c
  WHERE c.source_id = s.source_id
) a ON true
LEFT JOIN LATERAL (
  SELECT
    run.ingestion_run_id,
    run.status,
    run.started_at,
    run.completed_at,
    run.record_count,
    run.accepted_count,
    run.rejected_count
  FROM qassas_core.source_ingestion_run run
  WHERE run.portfolio_id = p.portfolio_id
    AND run.source_id = s.source_id
  ORDER BY run.started_at DESC, run.ingestion_run_id DESC
  LIMIT 1
) latest ON true;

COMMIT;
