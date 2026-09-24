BEGIN;

ALTER TABLE qassas_core.source_ingestion_run
  ADD COLUMN IF NOT EXISTS source_class_snapshot text,
  ADD COLUMN IF NOT EXISTS access_basis_snapshot text,
  ADD COLUMN IF NOT EXISTS agreement_id_snapshot text
    REFERENCES qassas_core.institution_access_agreement(agreement_id),
  ADD COLUMN IF NOT EXISTS allowed_domains_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE qassas_core.source_ingestion_record
  ADD COLUMN IF NOT EXISTS data_domain text,
  ADD COLUMN IF NOT EXISTS agreement_id_snapshot text
    REFERENCES qassas_core.institution_access_agreement(agreement_id);

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_private_source_connection (
  connection_id text PRIMARY KEY,
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  agreement_id text NOT NULL REFERENCES qassas_core.institution_access_agreement(agreement_id),
  connection_status text NOT NULL CHECK (
    connection_status IN ('CONNECTED','SUSPENDED','REVOKED')
  ),
  allowed_domains jsonb NOT NULL,
  activated_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  revoked_at timestamptz,
  correlation_id text NOT NULL,
  UNIQUE (portfolio_id, source_id, agreement_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_private_source_active_connection
  ON qassas_core.portfolio_private_source_connection(portfolio_id, source_id)
  WHERE connection_status = 'CONNECTED';

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_private_source_connection_event (
  connection_event_id text PRIMARY KEY,
  connection_id text NOT NULL REFERENCES qassas_core.portfolio_private_source_connection(connection_id),
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  agreement_id text NOT NULL REFERENCES qassas_core.institution_access_agreement(agreement_id),
  event_type text NOT NULL CHECK (
    event_type IN ('CONNECTED','SUSPENDED','REVOKED')
  ),
  actor_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  correlation_id text NOT NULL,
  allowed_domains_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS portfolio_private_source_connection_event_no_update
  ON qassas_core.portfolio_private_source_connection_event;
CREATE TRIGGER portfolio_private_source_connection_event_no_update
BEFORE UPDATE OR DELETE ON qassas_core.portfolio_private_source_connection_event
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE OR REPLACE FUNCTION qassas_core.validate_agreement_domains()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_invalid_count integer;
BEGIN
  IF jsonb_typeof(NEW.allowed_domains) <> 'array' THEN
    RAISE EXCEPTION 'Agreement allowed_domains must be a JSON array';
  END IF;

  IF NEW.agreement_status = 'ACTIVE'
     AND jsonb_array_length(NEW.allowed_domains) = 0 THEN
    RAISE EXCEPTION 'Active agreement requires at least one allowed data domain';
  END IF;

  SELECT count(*)::int
    INTO v_invalid_count
    FROM jsonb_array_elements_text(NEW.allowed_domains) d(domain)
   WHERE NOT EXISTS (
     SELECT 1
       FROM qassas_core.data_source_registry r,
            jsonb_array_elements_text(r.data_domains) allowed(domain)
      WHERE r.source_id = 'SRC-PARTNER-TERM-SHEET'
        AND allowed.domain = d.domain
   );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Agreement contains unsupported private data domain';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.agreement_status IN ('SIGNED','ACTIVE','EXPIRED','TERMINATED') THEN
    IF OLD.document_ref IS DISTINCT FROM NEW.document_ref
       OR OLD.document_hash IS DISTINCT FROM NEW.document_hash THEN
      RAISE EXCEPTION 'Signed agreement document identity is immutable';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.agreement_status IN ('ACTIVE','EXPIRED','TERMINATED')
     AND OLD.allowed_domains IS DISTINCT FROM NEW.allowed_domains THEN
    RAISE EXCEPTION 'Activated agreement data scope is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_access_agreement_domain_guard
  ON qassas_core.institution_access_agreement;
CREATE TRIGGER institution_access_agreement_domain_guard
BEFORE INSERT OR UPDATE ON qassas_core.institution_access_agreement
FOR EACH ROW EXECUTE FUNCTION qassas_core.validate_agreement_domains();

CREATE OR REPLACE FUNCTION qassas_core.enforce_ingestion_source_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_class text;
  v_access_basis text;
  v_access_status text;
  v_agreement_id text;
  v_agreement_status text;
  v_effective_from timestamptz;
  v_effective_to timestamptz;
  v_allowed_domains jsonb;
  v_connection_status text;
BEGIN
  SELECT
    r.source_class,
    s.access_basis,
    s.access_status,
    s.agreement_id,
    a.agreement_status,
    a.effective_from,
    a.effective_to,
    s.allowed_domains,
    c.connection_status
  INTO
    v_source_class,
    v_access_basis,
    v_access_status,
    v_agreement_id,
    v_agreement_status,
    v_effective_from,
    v_effective_to,
    v_allowed_domains,
    v_connection_status
  FROM qassas_core.portfolio_data_source s
  JOIN qassas_core.data_source_registry r
    ON r.source_id = s.source_id
  LEFT JOIN qassas_core.institution_access_agreement a
    ON a.agreement_id = s.agreement_id
  LEFT JOIN qassas_core.portfolio_private_source_connection c
    ON c.portfolio_id = s.portfolio_id
   AND c.source_id = s.source_id
   AND c.agreement_id = s.agreement_id
   AND c.connection_status = 'CONNECTED'
  WHERE s.portfolio_id = NEW.portfolio_id
    AND s.source_id = NEW.source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source % is not registered for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  IF v_source_class = 'PRIVATE_CONTRACTUAL' THEN
    IF v_access_status <> 'CONNECTED'
       OR v_connection_status <> 'CONNECTED'
       OR v_agreement_id IS NULL
       OR v_agreement_status <> 'ACTIVE'
       OR v_effective_from IS NULL
       OR v_effective_from > now()
       OR (v_effective_to IS NOT NULL AND v_effective_to <= now()) THEN
      RAISE EXCEPTION 'Private source % requires active contractual connection for portfolio %',
        NEW.source_id, NEW.portfolio_id;
    END IF;
  END IF;

  IF v_source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY')
     AND v_access_status NOT IN ('AVAILABLE','CONNECTED') THEN
    RAISE EXCEPTION 'Public source % is not available for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  NEW.source_class_snapshot := v_source_class;
  NEW.access_basis_snapshot := v_access_basis;
  NEW.agreement_id_snapshot := v_agreement_id;
  NEW.allowed_domains_snapshot := COALESCE(v_allowed_domains, '[]'::jsonb);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION qassas_core.enforce_ingestion_record_contract_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_class text;
  v_agreement_id text;
  v_allowed_domains jsonb;
BEGIN
  SELECT
    source_class_snapshot,
    agreement_id_snapshot,
    allowed_domains_snapshot
  INTO
    v_source_class,
    v_agreement_id,
    v_allowed_domains
  FROM qassas_core.source_ingestion_run
  WHERE ingestion_run_id = NEW.ingestion_run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingestion run % does not exist', NEW.ingestion_run_id;
  END IF;

  IF v_source_class = 'PRIVATE_CONTRACTUAL' THEN
    IF NEW.data_domain IS NULL OR btrim(NEW.data_domain) = '' THEN
      RAISE EXCEPTION 'Private ingestion record requires data_domain';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(v_allowed_domains) d(domain)
       WHERE d.domain = NEW.data_domain
    ) THEN
      RAISE EXCEPTION 'Data domain % is outside agreement scope', NEW.data_domain;
    END IF;

    NEW.agreement_id_snapshot := v_agreement_id;
    IF NEW.security_class = 'C0_PUBLIC' THEN
      NEW.security_class := 'C2_CONFIDENTIAL_TECHNICAL';
    END IF;
  END IF;

  IF v_source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY')
     AND NEW.agreement_id_snapshot IS NOT NULL THEN
    RAISE EXCEPTION 'Public ingestion record must not carry contractual agreement snapshot';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_ingestion_record_contract_scope
  ON qassas_core.source_ingestion_record;
CREATE TRIGGER source_ingestion_record_contract_scope
BEFORE INSERT ON qassas_core.source_ingestion_record
FOR EACH ROW EXECUTE FUNCTION qassas_core.enforce_ingestion_record_contract_scope();

CREATE OR REPLACE FUNCTION qassas_core.validate_private_source_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $
DECLARE
  v_portfolio_institution text;
  v_agreement_institution text;
  v_agreement_status text;
  v_effective_from timestamptz;
  v_effective_to timestamptz;
  v_source_class text;
BEGIN
  SELECT institution_id
    INTO v_portfolio_institution
    FROM qassas_core.institution_portfolio
   WHERE portfolio_id = NEW.portfolio_id;

  SELECT institution_id, agreement_status, effective_from, effective_to
    INTO v_agreement_institution, v_agreement_status, v_effective_from, v_effective_to
    FROM qassas_core.institution_access_agreement
   WHERE agreement_id = NEW.agreement_id;

  SELECT source_class
    INTO v_source_class
    FROM qassas_core.data_source_registry
   WHERE source_id = NEW.source_id;

  IF v_portfolio_institution IS NULL
     OR v_agreement_institution IS NULL
     OR v_portfolio_institution <> v_agreement_institution THEN
    RAISE EXCEPTION 'Agreement institution does not match portfolio institution';
  END IF;

  IF v_source_class <> 'PRIVATE_CONTRACTUAL' THEN
    RAISE EXCEPTION 'Private source connection requires PRIVATE_CONTRACTUAL source';
  END IF;

  IF NEW.connection_status = 'CONNECTED'
     AND (
       v_agreement_status <> 'ACTIVE'
       OR v_effective_from IS NULL
       OR v_effective_from > now()
       OR (v_effective_to IS NOT NULL AND v_effective_to <= now())
     ) THEN
    RAISE EXCEPTION 'Connected private source requires currently active agreement';
  END IF;

  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS portfolio_private_source_connection_guard
  ON qassas_core.portfolio_private_source_connection;
CREATE TRIGGER portfolio_private_source_connection_guard
BEFORE INSERT OR UPDATE ON qassas_core.portfolio_private_source_connection
FOR EACH ROW EXECUTE FUNCTION qassas_core.validate_private_source_connection();

CREATE OR REPLACE FUNCTION qassas_core.suspend_connections_for_ended_agreement()
RETURNS trigger
LANGUAGE plpgsql
AS $
BEGIN
  IF NEW.agreement_status IN ('EXPIRED','TERMINATED')
     AND OLD.agreement_status IS DISTINCT FROM NEW.agreement_status THEN
    UPDATE qassas_core.portfolio_private_source_connection
       SET connection_status = 'SUSPENDED',
           suspended_at = now()
     WHERE agreement_id = NEW.agreement_id
       AND connection_status = 'CONNECTED';

    UPDATE qassas_core.portfolio_data_source
       SET access_status = 'AGREEMENT_REQUIRED'
     WHERE agreement_id = NEW.agreement_id
       AND access_status = 'CONNECTED';
  END IF;

  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS institution_access_agreement_suspend_connections
  ON qassas_core.institution_access_agreement;
CREATE TRIGGER institution_access_agreement_suspend_connections
AFTER UPDATE OF agreement_status ON qassas_core.institution_access_agreement
FOR EACH ROW EXECUTE FUNCTION qassas_core.suspend_connections_for_ended_agreement();

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
  s.agreement_id,
  s.allowed_domains,
  r.connector_status,
  COALESCE(a.adapter_count, 0) AS adapter_count,
  a.adapter_states,
  c.connection_id,
  c.connection_status,
  c.activated_at AS connection_activated_at,
  latest.ingestion_run_id AS latest_ingestion_run_id,
  latest.status AS latest_ingestion_status,
  latest.started_at AS latest_ingestion_started_at,
  latest.completed_at AS latest_ingestion_completed_at,
  latest.record_count AS latest_record_count,
  latest.accepted_count AS latest_accepted_count,
  latest.rejected_count AS latest_rejected_count,
  latest.agreement_id_snapshot AS latest_agreement_id_snapshot,
  latest.allowed_domains_snapshot AS latest_allowed_domains_snapshot
FROM qassas_core.institution_portfolio p
JOIN qassas_core.portfolio_data_source s
  ON s.portfolio_id = p.portfolio_id
JOIN qassas_core.data_source_registry r
  ON r.source_id = s.source_id
LEFT JOIN qassas_core.portfolio_private_source_connection c
  ON c.portfolio_id = p.portfolio_id
 AND c.source_id = s.source_id
 AND c.agreement_id = s.agreement_id
 AND c.connection_status = 'CONNECTED'
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS adapter_count,
    jsonb_agg(
      jsonb_build_object(
        'adapter_id', adapter.adapter_id,
        'adapter_kind', adapter.adapter_kind,
        'status', adapter.adapter_status,
        'refresh_policy', adapter.refresh_policy
      )
      ORDER BY adapter.adapter_id
    ) AS adapter_states
  FROM qassas_core.source_adapter_contract adapter
  WHERE adapter.source_id = s.source_id
) a ON true
LEFT JOIN LATERAL (
  SELECT
    run.ingestion_run_id,
    run.status,
    run.started_at,
    run.completed_at,
    run.record_count,
    run.accepted_count,
    run.rejected_count,
    run.agreement_id_snapshot,
    run.allowed_domains_snapshot
  FROM qassas_core.source_ingestion_run run
  WHERE run.portfolio_id = p.portfolio_id
    AND run.source_id = s.source_id
  ORDER BY run.started_at DESC, run.ingestion_run_id DESC
  LIMIT 1
) latest ON true;

COMMIT;
