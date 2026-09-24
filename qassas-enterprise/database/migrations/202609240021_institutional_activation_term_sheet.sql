BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.institution_access_agreement (
  agreement_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES qassas_core.institution(institution_id),
  agreement_type text NOT NULL CHECK (
    agreement_type IN ('TERM_SHEET','DATA_SHARING_AGREEMENT','NDA','PILOT_AGREEMENT')
  ),
  agreement_status text NOT NULL CHECK (
    agreement_status IN ('DRAFT','SIGNED','ACTIVE','EXPIRED','TERMINATED')
  ),
  document_ref text NOT NULL,
  document_hash text NOT NULL,
  allowed_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  approved_by_user_id text REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_access_agreement_active
  ON qassas_core.institution_access_agreement(institution_id, agreement_status, effective_from);

ALTER TABLE qassas_core.portfolio_data_source
  ADD COLUMN IF NOT EXISTS agreement_id text
    REFERENCES qassas_core.institution_access_agreement(agreement_id);

ALTER TABLE qassas_security.institution_account
  ADD COLUMN IF NOT EXISTS primary_admin_user_id text
    REFERENCES qassas_security.user_identity(user_id),
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

CREATE TABLE IF NOT EXISTS qassas_security.institution_identity_binding_event (
  binding_event_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES qassas_core.institution(institution_id),
  account_id text NOT NULL REFERENCES qassas_security.institution_account(account_id),
  user_id text REFERENCES qassas_security.user_identity(user_id),
  external_subject text,
  event_type text NOT NULL CHECK (
    event_type IN ('PRIMARY_ADMIN_BOUND','PRIMARY_ADMIN_REBOUND','ACCOUNT_SUSPENDED','ACCOUNT_REVOKED')
  ),
  actor_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  correlation_id text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS institution_identity_binding_event_no_update
  ON qassas_security.institution_identity_binding_event;
CREATE TRIGGER institution_identity_binding_event_no_update
BEFORE UPDATE OR DELETE ON qassas_security.institution_identity_binding_event
FOR EACH ROW EXECUTE FUNCTION qassas_audit.deny_mutation();

CREATE OR REPLACE FUNCTION qassas_core.enforce_ingestion_source_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_class text;
  v_access_status text;
  v_agreement_id text;
  v_agreement_status text;
  v_effective_from timestamptz;
  v_effective_to timestamptz;
BEGIN
  SELECT
    r.source_class,
    s.access_status,
    s.agreement_id,
    a.agreement_status,
    a.effective_from,
    a.effective_to
  INTO
    v_source_class,
    v_access_status,
    v_agreement_id,
    v_agreement_status,
    v_effective_from,
    v_effective_to
  FROM qassas_core.portfolio_data_source s
  JOIN qassas_core.data_source_registry r
    ON r.source_id = s.source_id
  LEFT JOIN qassas_core.institution_access_agreement a
    ON a.agreement_id = s.agreement_id
  WHERE s.portfolio_id = NEW.portfolio_id
    AND s.source_id = NEW.source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source % is not registered for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  IF v_source_class = 'PRIVATE_CONTRACTUAL' THEN
    IF v_access_status <> 'CONNECTED'
       OR v_agreement_id IS NULL
       OR v_agreement_status <> 'ACTIVE'
       OR v_effective_from IS NULL
       OR v_effective_from > now()
       OR (v_effective_to IS NOT NULL AND v_effective_to <= now()) THEN
      RAISE EXCEPTION 'Private source % requires active contractual agreement for portfolio %',
        NEW.source_id, NEW.portfolio_id;
    END IF;
  END IF;

  IF v_source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY')
     AND v_access_status NOT IN ('AVAILABLE','CONNECTED') THEN
    RAISE EXCEPTION 'Public source % is not available for portfolio %',
      NEW.source_id, NEW.portfolio_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW qassas_core.institution_onboarding_status AS
SELECT
  i.institution_id,
  i.enterprise_id,
  i.display_name,
  ia.account_id,
  ia.account_name,
  ia.iam_binding_status,
  ia.status AS account_status,
  ia.primary_admin_user_id,
  ia.activated_at,
  CASE
    WHEN ia.status = 'ACTIVE'
      AND ia.iam_binding_status = 'BOUND'
      AND ia.primary_admin_user_id IS NOT NULL
      THEN true
    ELSE false
  END AS login_enabled,
  COALESCE(agreements.active_agreement_count, 0) AS active_agreement_count,
  COALESCE(sources.connected_private_source_count, 0) AS connected_private_source_count,
  COALESCE(sources.term_sheet_required_count, 0) AS term_sheet_required_count
FROM qassas_core.institution i
LEFT JOIN qassas_security.institution_account ia
  ON ia.institution_id = i.institution_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS active_agreement_count
  FROM qassas_core.institution_access_agreement a
  WHERE a.institution_id = i.institution_id
    AND a.agreement_status = 'ACTIVE'
    AND a.effective_from IS NOT NULL
    AND a.effective_from <= now()
    AND (a.effective_to IS NULL OR a.effective_to > now())
) agreements ON true
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (
      WHERE r.source_class = 'PRIVATE_CONTRACTUAL'
        AND s.access_status = 'CONNECTED'
    )::int AS connected_private_source_count,
    count(*) FILTER (
      WHERE r.source_class = 'PRIVATE_CONTRACTUAL'
        AND s.access_status = 'TERM_SHEET_REQUIRED'
    )::int AS term_sheet_required_count
  FROM qassas_core.institution_portfolio p
  JOIN qassas_core.portfolio_data_source s
    ON s.portfolio_id = p.portfolio_id
  JOIN qassas_core.data_source_registry r
    ON r.source_id = s.source_id
  WHERE p.institution_id = i.institution_id
) sources ON true;

COMMIT;
