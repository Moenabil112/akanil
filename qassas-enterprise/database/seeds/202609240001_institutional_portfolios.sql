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


INSERT INTO qassas_core.source_adapter_contract (
  adapter_id, source_id, adapter_kind, endpoint_class, endpoint_value,
  content_format, adapter_status, refresh_policy, configuration
)
VALUES
  (
    'ADP-SGS-NGD-CATALOG',
    'SRC-SGS-NGD',
    'OGC_CATALOG',
    'PUBLIC_URL',
    'https://ngd.sgs.gov.sa/',
    'OGC_CATALOG',
    'AVAILABLE_READ_ONLY',
    'ON_DEMAND',
    '{"capabilities":["WFS","WMS","WCS","GeoRSS"],"endpoint_discovery":"CATALOG_DRIVEN","raw_payload_storage":false}'::jsonb
  ),
  (
    'ADP-SGS-NGD-WFS',
    'SRC-SGS-NGD',
    'OGC_WFS',
    'ENV_REFERENCE',
    'SGS_NGD_WFS_URL',
    'GML_GEOJSON',
    'CONFIG_REQUIRED',
    'SCHEDULED_DAILY',
    '{"require_get_capabilities":true,"allowed_protocol":"HTTPS","raw_payload_storage":false}'::jsonb
  ),
  (
    'ADP-TAADEN-LICENCE-PAGE',
    'SRC-TAADEN',
    'PUBLIC_RECORD_PAGE',
    'PUBLIC_URL',
    'https://taadeen.sa/en/mining-info/licenses/{license_number}',
    'HTML_PUBLIC_RECORD',
    'AVAILABLE_READ_ONLY',
    'SCHEDULED_DAILY',
    '{"record_key":"license_number","robots_and_terms_review_required":true,"raw_payload_storage":false}'::jsonb
  ),
  (
    'ADP-TAADEN-INVESTOR-PAGE',
    'SRC-TAADEN',
    'PUBLIC_RECORD_PAGE',
    'PUBLIC_URL',
    'https://taadeen.sa/en/mining-info/investors/{unified_number}',
    'HTML_PUBLIC_RECORD',
    'AVAILABLE_READ_ONLY',
    'SCHEDULED_DAILY',
    '{"record_key":"unified_number","robots_and_terms_review_required":true,"raw_payload_storage":false}'::jsonb
  ),
  (
    'ADP-PARTNER-DATAROOM',
    'SRC-PARTNER-TERM-SHEET',
    'PARTNER_DATA_ROOM',
    'CONTRACTUAL_ENDPOINT',
    NULL,
    'CONTROLLED_FILE_OR_API',
    'TERM_SHEET_REQUIRED',
    'ON_DEMAND',
    '{"malware_scan_required":true,"checksum_required":true,"raw_payload_storage":"CONTROLLED_OBJECT_STORE_ONLY"}'::jsonb
  )
ON CONFLICT (adapter_id) DO UPDATE
SET endpoint_value = EXCLUDED.endpoint_value,
    content_format = EXCLUDED.content_format,
    adapter_status = EXCLUDED.adapter_status,
    refresh_policy = EXCLUDED.refresh_policy,
    configuration = EXCLUDED.configuration,
    updated_at = now();


INSERT INTO qassas_core.portfolio_asset_registry (
  asset_id, portfolio_id, enterprise_id, asset_name, asset_type,
  external_licence_number, region, area_km2, mineral_classes,
  source_of_record_id, source_object_id, master_data_status,
  security_class, public_data_last_seen_at
)
VALUES
  ('AST-ARTAR-14433112', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 14433112', 'EXPLORATION_LICENCE', '14433112', 'Riyadh', 98.84, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '14433112', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-14433113', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 14433113', 'EXPLORATION_LICENCE', '14433113', 'Riyadh', 85.34, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '14433113', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-14433131', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 14433131', 'EXPLORATION_LICENCE', '14433131', 'Makkah', 99.85, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '14433131', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-1444345', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 1444345', 'EXPLORATION_LICENCE', '1444345', 'Aseer', 44.82, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '1444345', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-1444360', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 1444360', 'EXPLORATION_LICENCE', '1444360', 'Aseer', 68.01, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '1444360', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-1444367', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 1444367', 'EXPLORATION_LICENCE', '1444367', 'Makkah', 52.82, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '1444367', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-1444368', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 1444368', 'EXPLORATION_LICENCE', '1444368', 'Al Bahah', 27.31, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '1444368', 'PUBLIC_VERIFIED', 'C0_PUBLIC', '2026-09-02T13:33:00Z'),
  ('AST-ARTAR-20250300583', 'PORT-ARTAR-KSA', 'ENT-ARTAR-KSA', 'ARTAR Exploration Licence 20250300583', 'EXPLORATION_LICENCE', '20250300583', NULL, 26.34, '["CLASS_A"]'::jsonb, 'SRC-TAADEN', '20250300583', 'DISCOVERED', 'C0_PUBLIC', '2026-09-02T13:33:00Z')
ON CONFLICT (asset_id) DO UPDATE
SET asset_name = EXCLUDED.asset_name,
    asset_type = EXCLUDED.asset_type,
    external_licence_number = EXCLUDED.external_licence_number,
    region = EXCLUDED.region,
    area_km2 = EXCLUDED.area_km2,
    mineral_classes = EXCLUDED.mineral_classes,
    source_of_record_id = EXCLUDED.source_of_record_id,
    source_object_id = EXCLUDED.source_object_id,
    master_data_status = CASE
      WHEN qassas_core.portfolio_asset_registry.master_data_status = 'PARTNER_CONFIRMED'
        THEN 'PARTNER_CONFIRMED'
      ELSE EXCLUDED.master_data_status
    END,
    public_data_last_seen_at = EXCLUDED.public_data_last_seen_at,
    updated_at = now();

INSERT INTO qassas_core.asset_source_identity (
  source_id, source_object_id, asset_id, match_method,
  identity_confidence, last_seen_at
)
SELECT
  'SRC-TAADEN',
  a.source_object_id,
  a.asset_id,
  'EXACT_PUBLIC_ID',
  1,
  a.public_data_last_seen_at
FROM qassas_core.portfolio_asset_registry a
WHERE a.portfolio_id = 'PORT-ARTAR-KSA'
  AND a.source_of_record_id = 'SRC-TAADEN'
  AND a.source_object_id IS NOT NULL
ON CONFLICT (source_id, source_object_id) DO UPDATE
SET asset_id = EXCLUDED.asset_id,
    match_method = EXCLUDED.match_method,
    identity_confidence = EXCLUDED.identity_confidence,
    last_seen_at = EXCLUDED.last_seen_at;


INSERT INTO qassas_security.user_identity (user_id, external_subject, status)
VALUES
  ('USR-E2E-ATLAS', '88888888-8888-4888-8888-888888888888', 'ACTIVE'),
  ('USR-E2E-ARTAR', '99999999-9999-4999-8999-999999999999', 'ACTIVE')
ON CONFLICT (user_id) DO UPDATE
SET external_subject = EXCLUDED.external_subject,
    status = EXCLUDED.status;

INSERT INTO qassas_security.role_assignment (
  role_assignment_id, user_id, role_type, asset_scope, jv_scope,
  decision_class_scope, capital_threshold, security_clearance,
  effective_from, effective_to, status
)
VALUES
  (
    'RA-E2E-ATLAS-INSTITUTION', 'USR-E2E-ATLAS', 'INSTITUTION_VIEWER',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    NULL, 'C1_INTERNAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
  ),
  (
    'RA-E2E-ARTAR-INSTITUTION', 'USR-E2E-ARTAR', 'INSTITUTION_VIEWER',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    NULL, 'C1_INTERNAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
  )
ON CONFLICT (role_assignment_id) DO UPDATE
SET status = 'ACTIVE',
    effective_to = NULL;

INSERT INTO qassas_security.institution_membership (
  membership_id, institution_id, user_id, institution_role,
  status, effective_from, effective_to
)
VALUES
  (
    'MEM-E2E-ATLAS', 'INST-ATLAS-GOLDEN-KSA', 'USR-E2E-ATLAS',
    'INSTITUTION_VIEWER', 'ACTIVE', '2026-01-01T00:00:00Z', NULL
  ),
  (
    'MEM-E2E-ARTAR', 'INST-ARTAR-KSA', 'USR-E2E-ARTAR',
    'INSTITUTION_VIEWER', 'ACTIVE', '2026-01-01T00:00:00Z', NULL
  )
ON CONFLICT (institution_id, user_id, institution_role) DO UPDATE
SET status = 'ACTIVE',
    effective_to = NULL;

COMMIT;
