BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.institution (
  institution_id text PRIMARY KEY,
  enterprise_id text NOT NULL UNIQUE REFERENCES qassas_core.enterprise(enterprise_id),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'SA',
  institution_kind text NOT NULL CHECK (
    institution_kind IN (
      'MINING_OPERATOR',
      'MINING_INVESTOR',
      'INTEGRATED_MINING_REFINING',
      'MINING_HOLDING'
    )
  ),
  public_identity_status text NOT NULL DEFAULT 'PUBLIC_VERIFIED' CHECK (
    public_identity_status IN ('PUBLIC_VERIFIED','PARTNER_VERIFIED','PENDING_VERIFICATION')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.institution_portfolio (
  portfolio_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES qassas_core.institution(institution_id),
  enterprise_id text NOT NULL REFERENCES qassas_core.enterprise(enterprise_id),
  portfolio_name text NOT NULL,
  portfolio_kind text NOT NULL DEFAULT 'MINERAL_RIGHTS_AND_PROJECTS',
  public_asset_count integer CHECK (public_asset_count IS NULL OR public_asset_count >= 0),
  asset_count_basis text,
  scale_class text NOT NULL CHECK (
    scale_class IN ('FOCUSED','PORTFOLIO','LARGE_PORTFOLIO','ENTERPRISE','ADAPTIVE_UNKNOWN')
  ),
  status text NOT NULL CHECK (status IN ('ONBOARDING','ACTIVE','SUSPENDED','ARCHIVED')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, portfolio_name)
);

CREATE INDEX IF NOT EXISTS idx_institution_portfolio_enterprise
  ON qassas_core.institution_portfolio(enterprise_id, status);

CREATE TABLE IF NOT EXISTS qassas_security.institution_account (
  account_id text PRIMARY KEY,
  institution_id text NOT NULL UNIQUE REFERENCES qassas_core.institution(institution_id),
  account_name text NOT NULL,
  identity_kind text NOT NULL DEFAULT 'INSTITUTION_CONTROLLED_ACCOUNT' CHECK (
    identity_kind IN ('INSTITUTION_CONTROLLED_ACCOUNT','SERVICE_PRINCIPAL')
  ),
  external_subject text UNIQUE,
  iam_binding_status text NOT NULL DEFAULT 'PENDING_IDP_LINK' CHECK (
    iam_binding_status IN ('PENDING_IDP_LINK','BOUND','SUSPENDED')
  ),
  status text NOT NULL DEFAULT 'PROVISIONED' CHECK (
    status IN ('PROVISIONED','ACTIVE','SUSPENDED','REVOKED')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_security.institution_membership (
  membership_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES qassas_core.institution(institution_id),
  user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  institution_role text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id, institution_role)
);

CREATE INDEX IF NOT EXISTS idx_institution_membership_user
  ON qassas_security.institution_membership(user_id, status);

CREATE TABLE IF NOT EXISTS qassas_core.data_source_registry (
  source_id text PRIMARY KEY,
  source_name text NOT NULL,
  source_authority text NOT NULL,
  source_class text NOT NULL CHECK (
    source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY','PRIVATE_CONTRACTUAL')
  ),
  acquisition_mode text NOT NULL CHECK (
    acquisition_mode IN (
      'PORTAL_OR_EXPORT_ADAPTER',
      'APPROVED_API',
      'CONTROLLED_FILE_EXCHANGE',
      'PARTNER_DATA_ROOM'
    )
  ),
  source_url text,
  data_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  connector_status text NOT NULL CHECK (
    connector_status IN ('CONTRACT_DEFINED','AVAILABLE','CONNECTED','SUSPENDED')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_data_source (
  portfolio_id text NOT NULL REFERENCES qassas_core.institution_portfolio(portfolio_id),
  source_id text NOT NULL REFERENCES qassas_core.data_source_registry(source_id),
  access_basis text NOT NULL CHECK (
    access_basis IN ('PUBLIC_INFORMATION','TERM_SHEET','DATA_SHARING_AGREEMENT')
  ),
  access_status text NOT NULL CHECK (
    access_status IN ('AVAILABLE','TERM_SHEET_REQUIRED','AGREEMENT_REQUIRED','CONNECTED','SUSPENDED')
  ),
  allowed_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_requirement text NOT NULL DEFAULT 'SOURCE_OBJECT_AND_RETRIEVAL_TIMESTAMP_REQUIRED',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, source_id)
);

CREATE OR REPLACE VIEW qassas_core.institution_portfolio_directory AS
SELECT
  p.portfolio_id,
  p.portfolio_name,
  p.portfolio_kind,
  p.public_asset_count,
  p.asset_count_basis,
  p.scale_class,
  p.status AS portfolio_status,
  i.institution_id,
  i.enterprise_id,
  i.legal_name,
  i.display_name,
  i.country_code,
  i.institution_kind,
  i.public_identity_status,
  ia.account_id,
  ia.account_name,
  ia.iam_binding_status,
  ia.status AS account_status,
  COALESCE(ds.public_source_count, 0) AS public_source_count,
  COALESCE(ds.private_source_count, 0) AS private_source_count,
  COALESCE(ds.term_sheet_required_count, 0) AS term_sheet_required_count
FROM qassas_core.institution_portfolio p
JOIN qassas_core.institution i
  ON i.institution_id = p.institution_id
LEFT JOIN qassas_security.institution_account ia
  ON ia.institution_id = i.institution_id
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE r.source_class IN ('PUBLIC_SOVEREIGN','PUBLIC_REGULATORY'))::int AS public_source_count,
    count(*) FILTER (WHERE r.source_class = 'PRIVATE_CONTRACTUAL')::int AS private_source_count,
    count(*) FILTER (WHERE s.access_status = 'TERM_SHEET_REQUIRED')::int AS term_sheet_required_count
  FROM qassas_core.portfolio_data_source s
  JOIN qassas_core.data_source_registry r ON r.source_id = s.source_id
  WHERE s.portfolio_id = p.portfolio_id
) ds ON true;

COMMIT;
