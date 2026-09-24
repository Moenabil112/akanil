BEGIN;

INSERT INTO qassas_core.enterprise (enterprise_id, name, status)
VALUES
  ('ENT-ATLAS-GOLDEN-KSA', 'Atlas Golden Mining — Saudi Arabia', 'ACTIVE'),
  ('ENT-ARTAR-KSA', 'Abdulrahman Saad Al-Rashed & Sons Co.', 'ACTIVE'),
  ('ENT-AJLAN-MINING-KSA', 'Ajlan & Bros Mining & Metals', 'ACTIVE'),
  ('ENT-SGR-KSA', 'Saudi Gold Refinery Company', 'ACTIVE')
ON CONFLICT (enterprise_id) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status;

INSERT INTO qassas_core.institution (
  institution_id, enterprise_id, legal_name, display_name, country_code,
  institution_kind, public_identity_status, metadata
)
VALUES
  (
    'INST-ATLAS-GOLDEN-KSA',
    'ENT-ATLAS-GOLDEN-KSA',
    'Atlas Golden Mining — Saudi Arabia',
    'Atlas Golden Mining',
    'SA',
    'MINING_OPERATOR',
    'PARTNER_VERIFIED',
    '{"onboarding_basis":"QASSAS_PROGRAMME_PARTNER","private_data_status":"TERM_SHEET_REQUIRED"}'::jsonb
  ),
  (
    'INST-ARTAR-KSA',
    'ENT-ARTAR-KSA',
    'Abdulrahman Saad Al-Rashed & Sons Co.',
    'Abdulrahman Saad Al-Rashed & Sons',
    'SA',
    'MINING_HOLDING',
    'PUBLIC_VERIFIED',
    '{"public_reference":"TAADEN_INVESTOR_7007259752","private_data_status":"TERM_SHEET_REQUIRED"}'::jsonb
  ),
  (
    'INST-AJLAN-MINING-KSA',
    'ENT-AJLAN-MINING-KSA',
    'Ajlan & Bros Mining & Metals',
    'Ajlan & Bros Mining & Metals',
    'SA',
    'MINING_INVESTOR',
    'PUBLIC_VERIFIED',
    '{"public_reference":"AJLAN_BROS_MINING_PUBLIC","private_data_status":"TERM_SHEET_REQUIRED"}'::jsonb
  ),
  (
    'INST-SGR-KSA',
    'ENT-SGR-KSA',
    'Saudi Gold Refinery Company',
    'Saudi Gold Refinery',
    'SA',
    'INTEGRATED_MINING_REFINING',
    'PUBLIC_VERIFIED',
    '{"public_reference":"SGR_PUBLIC","private_data_status":"TERM_SHEET_REQUIRED"}'::jsonb
  )
ON CONFLICT (institution_id) DO UPDATE
SET legal_name = EXCLUDED.legal_name,
    display_name = EXCLUDED.display_name,
    institution_kind = EXCLUDED.institution_kind,
    public_identity_status = EXCLUDED.public_identity_status,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO qassas_core.institution_portfolio (
  portfolio_id, institution_id, enterprise_id, portfolio_name, portfolio_kind,
  public_asset_count, asset_count_basis, scale_class, status, configuration
)
VALUES
  (
    'PORT-ATLAS-GOLDEN-KSA',
    'INST-ATLAS-GOLDEN-KSA',
    'ENT-ATLAS-GOLDEN-KSA',
    'Atlas Golden Mining Saudi Portfolio',
    'MINERAL_RIGHTS_AND_PROJECTS',
    NULL,
    'PARTNER_DATA_PENDING',
    'ADAPTIVE_UNKNOWN',
    'ONBOARDING',
    '{"default_view":"MAP_AND_DECISION_QUEUE","partner_mode":"CONTROLLED"}'::jsonb
  ),
  (
    'PORT-ARTAR-KSA',
    'INST-ARTAR-KSA',
    'ENT-ARTAR-KSA',
    'Abdulrahman Saad Al-Rashed & Sons Mining Portfolio',
    'MINERAL_RIGHTS_AND_PROJECTS',
    8,
    'TAADEN_PUBLIC_ACTIVE_LICENCES_2026-09-02',
    'PORTFOLIO',
    'ONBOARDING',
    '{"default_view":"CONTROL_BOARD","partner_mode":"CONTROLLED"}'::jsonb
  ),
  (
    'PORT-AJLAN-MINING-KSA',
    'INST-AJLAN-MINING-KSA',
    'ENT-AJLAN-MINING-KSA',
    'Ajlan & Bros Mining & Metals Portfolio',
    'MINERAL_RIGHTS_AND_PROJECTS',
    38,
    'CORPORATE_PUBLIC_PORTFOLIO_STATEMENT_2026',
    'LARGE_PORTFOLIO',
    'ONBOARDING',
    '{"default_view":"PORTFOLIO_HEATMAP","partner_mode":"CONTROLLED"}'::jsonb
  ),
  (
    'PORT-SGR-KSA',
    'INST-SGR-KSA',
    'ENT-SGR-KSA',
    'Saudi Gold Refinery Mining Portfolio',
    'MINERAL_RIGHTS_AND_PROJECTS',
    NULL,
    'PUBLIC_PORTFOLIO_COUNT_NOT_LOCKED',
    'ADAPTIVE_UNKNOWN',
    'ONBOARDING',
    '{"default_view":"VALUE_CHAIN_AND_PORTFOLIO","partner_mode":"CONTROLLED"}'::jsonb
  )
ON CONFLICT (portfolio_id) DO UPDATE
SET portfolio_name = EXCLUDED.portfolio_name,
    public_asset_count = EXCLUDED.public_asset_count,
    asset_count_basis = EXCLUDED.asset_count_basis,
    scale_class = EXCLUDED.scale_class,
    status = EXCLUDED.status,
    configuration = EXCLUDED.configuration,
    updated_at = now();

INSERT INTO qassas_security.institution_account (
  account_id, institution_id, account_name, identity_kind,
  external_subject, iam_binding_status, status
)
VALUES
  ('IACCT-ATLAS-GOLDEN-KSA', 'INST-ATLAS-GOLDEN-KSA', 'Atlas Golden Mining Institutional Account', 'INSTITUTION_CONTROLLED_ACCOUNT', NULL, 'PENDING_IDP_LINK', 'PROVISIONED'),
  ('IACCT-ARTAR-KSA', 'INST-ARTAR-KSA', 'ARTAR Institutional Account', 'INSTITUTION_CONTROLLED_ACCOUNT', NULL, 'PENDING_IDP_LINK', 'PROVISIONED'),
  ('IACCT-AJLAN-MINING-KSA', 'INST-AJLAN-MINING-KSA', 'Ajlan & Bros Mining Institutional Account', 'INSTITUTION_CONTROLLED_ACCOUNT', NULL, 'PENDING_IDP_LINK', 'PROVISIONED'),
  ('IACCT-SGR-KSA', 'INST-SGR-KSA', 'Saudi Gold Refinery Institutional Account', 'INSTITUTION_CONTROLLED_ACCOUNT', NULL, 'PENDING_IDP_LINK', 'PROVISIONED')
ON CONFLICT (account_id) DO UPDATE
SET account_name = EXCLUDED.account_name,
    updated_at = now();

INSERT INTO qassas_core.data_source_registry (
  source_id, source_name, source_authority, source_class,
  acquisition_mode, source_url, data_domains, connector_status
)
VALUES
  (
    'SRC-SGS-NGD',
    'Saudi National Geological Database',
    'Saudi Geological Survey',
    'PUBLIC_SOVEREIGN',
    'PORTAL_OR_EXPORT_ADAPTER',
    'https://ngd.sgs.gov.sa/',
    '["GEOLOGY","MINERAL_OCCURRENCES","GEOCHEMISTRY","GEOPHYSICS","BOREHOLES","SURFACE_SAMPLES","REMOTE_SENSING","MAPS"]'::jsonb,
    'AVAILABLE'
  ),
  (
    'SRC-TAADEN',
    'Taadeen Platform',
    'Ministry of Industry and Mineral Resources',
    'PUBLIC_REGULATORY',
    'PORTAL_OR_EXPORT_ADAPTER',
    'https://taadeen.sa/',
    '["INVESTORS","LICENCES","LICENCE_STATUS","LICENCE_TYPE","AREA","REGION","MINERAL_CLASS","PUBLIC_COORDINATES"]'::jsonb,
    'AVAILABLE'
  ),
  (
    'SRC-PARTNER-TERM-SHEET',
    'Institution Partner Data Room',
    'Contracting Institution',
    'PRIVATE_CONTRACTUAL',
    'PARTNER_DATA_ROOM',
    NULL,
    '["WORK_PROGRAMMES","PRIVATE_GEOLOGY","ASSAYS","DRILLING","GEOPHYSICS","GEOCHEMISTRY","CAPITAL","JV_RIGHTS","COMMERCIAL_TERMS","INTERNAL_DECISIONS"]'::jsonb,
    'CONTRACT_DEFINED'
  )
ON CONFLICT (source_id) DO UPDATE
SET source_name = EXCLUDED.source_name,
    source_authority = EXCLUDED.source_authority,
    source_class = EXCLUDED.source_class,
    acquisition_mode = EXCLUDED.acquisition_mode,
    source_url = EXCLUDED.source_url,
    data_domains = EXCLUDED.data_domains,
    connector_status = EXCLUDED.connector_status;

INSERT INTO qassas_core.portfolio_data_source (
  portfolio_id, source_id, access_basis, access_status, allowed_domains
)
SELECT p.portfolio_id, s.source_id, 'PUBLIC_INFORMATION', 'AVAILABLE', s.data_domains
FROM qassas_core.institution_portfolio p
CROSS JOIN qassas_core.data_source_registry s
WHERE s.source_id IN ('SRC-SGS-NGD','SRC-TAADEN')
ON CONFLICT (portfolio_id, source_id) DO UPDATE
SET access_status = EXCLUDED.access_status,
    allowed_domains = EXCLUDED.allowed_domains;

INSERT INTO qassas_core.portfolio_data_source (
  portfolio_id, source_id, access_basis, access_status, allowed_domains
)
SELECT
  p.portfolio_id,
  'SRC-PARTNER-TERM-SHEET',
  'TERM_SHEET',
  'TERM_SHEET_REQUIRED',
  r.data_domains
FROM qassas_core.institution_portfolio p
JOIN qassas_core.data_source_registry r
  ON r.source_id = 'SRC-PARTNER-TERM-SHEET'
ON CONFLICT (portfolio_id, source_id) DO UPDATE
SET access_status = EXCLUDED.access_status,
    allowed_domains = EXCLUDED.allowed_domains;

COMMIT;
