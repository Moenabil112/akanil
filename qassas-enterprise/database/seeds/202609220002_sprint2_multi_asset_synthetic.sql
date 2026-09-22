BEGIN;

INSERT INTO qassas_security.user_identity (
  user_id, external_subject, status
) VALUES (
  'USR-CP-001',
  '66666666-6666-4666-8666-666666666666',
  'ACTIVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_core.workflow_template (
  template_code, template_name, decision_class, initial_gate,
  required_evidence_classes, default_reviewer_role,
  rule_set_version, configuration
) VALUES
(
  'WT-MRE-READINESS',
  'MRE Readiness',
  'MRE_READINESS',
  'G7_RESOURCE_DEFINITION',
  '["DRILLING","ASSAY_QAQC","DENSITY","METALLURGY","GEOTECH"]'::jsonb,
  'RESOURCE_GEOLOGIST_CP',
  'S2-RULES-0.1',
  '{"objective":"Determine whether evidence is sufficiently controlled for resource-estimation readiness","no_broad_drilling_default":true}'::jsonb
),
(
  'WT-DISCOVERY-TO-RESOURCE',
  'Discovery to Resource',
  'DISCOVERY_REVIEW',
  'G6_DISCOVERY',
  '["DRILLING","GEOPHYSICS"]'::jsonb,
  'EXPLORATION_DIRECTOR',
  'S2-RULES-0.1',
  '{"objective":"Resolve geometry/continuity before broad resource-definition drilling"}'::jsonb
),
(
  'WT-MULTI-TARGET-JV',
  'Multi-Target Portfolio + JV',
  'MULTI_TARGET_PORTFOLIO',
  'G2_TARGET_GENERATED',
  '["TARGET_INVENTORY","HISTORICAL_DATA","GEOPHYSICS","GEOCHEMISTRY"]'::jsonb,
  'EXPLORATION_DIRECTOR',
  'S2-RULES-0.1',
  '{"objective":"Prioritise target-level tests while preserving JV consent controls","partner_consent_sensitive":true}'::jsonb
),
(
  'WT-RESOURCE-GROWTH-VOI',
  'Resource Growth Value-of-Information',
  'INCREMENTAL_RESOURCE_VALUE',
  'G8_RESOURCE_GROWTH',
  '["RESOURCE_MODEL","DRILLING","ECONOMICS"]'::jsonb,
  'EXPLORATION_DIRECTOR',
  'S2-RULES-0.1',
  '{"objective":"Test incremental resource value before extension drilling","voi_required":true}'::jsonb
),
(
  'WT-COVERED-TARGET-TEST',
  'Covered Target Method Selection',
  'COVERED_TARGET_TEST',
  'G2_TARGET_GENERATED',
  '["HISTORICAL_SAMPLE","STRUCTURAL","COVER","PETROPHYSICS"]'::jsonb,
  'EXPLORATION_DIRECTOR',
  'S2-RULES-0.1',
  '{"objective":"Select the next-best covered-target method before drilling","historical_grade_not_drill_ready":true}'::jsonb
)
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO qassas_core.target (
  target_id, enterprise_id, prospect_id, asset_id, name,
  current_gate, operational_state, target_status, security_class
) VALUES
(
  'TGT-UHM-VMS-001',
  'ENT-GMCO-001',
  'PROS-UHM-VMS-001',
  'LIC-UHM-001',
  'Umm Hijlan VMS — Synthetic Pilot Target',
  'G7_RESOURCE_DEFINITION',
  'NORMAL_PROCESSING',
  'ACTIVE',
  'C2_CONFIDENTIAL_TECHNICAL'
),
(
  'TGT-MAM-GOLD-001',
  'ENT-GMCO-001',
  'PROS-MAM-GOLD-001',
  'LIC-UHM-001',
  'Mamilah Gold — Synthetic Pilot Target',
  'G7_RESOURCE_DEFINITION',
  'NORMAL_PROCESSING',
  'ACTIVE',
  'C2_CONFIDENTIAL_TECHNICAL'
),
(
  'TGT-AG-GROWTH-001',
  'ENT-GMCO-001',
  'PROS-AG-GROWTH-001',
  'LIC-ALGODEYER-001',
  'Al Godeyer Resource Growth — Synthetic Pilot Target',
  'G8_RESOURCE_GROWTH',
  'NORMAL_PROCESSING',
  'ACTIVE',
  'C2_CONFIDENTIAL_TECHNICAL'
),
(
  'TGT-JAD-COVERED-001',
  'ENT-GMCO-001',
  'PROS-JAD-COVERED-001',
  'LIC-JADIB-001',
  'Jadib Al Qahtanah Covered Target — Synthetic Pilot Target',
  'G2_TARGET_GENERATED',
  'NORMAL_PROCESSING',
  'ACTIVE',
  'C2_CONFIDENTIAL_TECHNICAL'
)
ON CONFLICT (target_id) DO UPDATE SET
  current_gate = EXCLUDED.current_gate,
  operational_state = EXCLUDED.operational_state,
  target_status = EXCLUDED.target_status,
  security_class = EXCLUDED.security_class;

INSERT INTO qassas_core.pilot_asset_profile (
  profile_id, enterprise_id, asset_id, asset_name,
  decision_object_key, decision_class, configured_gate,
  workflow_template_code, primary_target_id, secondary_target_ids,
  display_order, security_class, pilot_status, configuration
) VALUES
(
  'PILOT-ASSET-UHM',
  'ENT-GMCO-001',
  'LIC-UHM-001',
  'Umm Hijlan / Mamilah',
  'DO-001',
  'MRE_READINESS',
  'G7_RESOURCE_DEFINITION',
  'WT-MRE-READINESS',
  'TGT-UHM-VMS-001',
  '["TGT-MAM-GOLD-001"]'::jsonb,
  1,
  'C2_CONFIDENTIAL_TECHNICAL',
  'ACTIVE',
  '{"decision_leverage":"RESOURCE_READINESS","separate_prospects_required":true}'::jsonb
),
(
  'PILOT-ASSET-AS',
  'ENT-GMCO-001',
  'LIC-ABUSALAL-001',
  'Abu Salal',
  'DO-002',
  'DISCOVERY_REVIEW',
  'G6_DISCOVERY',
  'WT-DISCOVERY-TO-RESOURCE',
  'TGT-AS-CORE-001',
  '[]'::jsonb,
  2,
  'C2_CONFIDENTIAL_TECHNICAL',
  'ACTIVE',
  '{"decision_leverage":"DISCOVERY_TO_RESOURCE","core_continuity_unresolved":true}'::jsonb
),
(
  'PILOT-ASSET-AHN',
  'ENT-GMCO-001',
  'LIC-AHN-001',
  'Al Hajar North',
  'DO-003',
  'MULTI_TARGET_PORTFOLIO',
  'G2_TARGET_GENERATED',
  'WT-MULTI-TARGET-JV',
  'TGT-AHN-PORT-001',
  '[]'::jsonb,
  3,
  'C3_COMMERCIAL_JV_RESTRICTED',
  'ACTIVE',
  '{"decision_leverage":"MULTI_TARGET_PORTFOLIO","jv_controlled":true}'::jsonb
),
(
  'PILOT-ASSET-AG',
  'ENT-GMCO-001',
  'LIC-ALGODEYER-001',
  'Al Godeyer',
  'DO-004',
  'INCREMENTAL_RESOURCE_VALUE',
  'G8_RESOURCE_GROWTH',
  'WT-RESOURCE-GROWTH-VOI',
  'TGT-AG-GROWTH-001',
  '[]'::jsonb,
  4,
  'C2_CONFIDENTIAL_TECHNICAL',
  'ACTIVE',
  '{"decision_leverage":"INCREMENTAL_RESOURCE_VALUE","voi_required":true}'::jsonb
),
(
  'PILOT-ASSET-JAD',
  'ENT-GMCO-001',
  'LIC-JADIB-001',
  'Jadib Al Qahtanah',
  'DO-005',
  'COVERED_TARGET_TEST',
  'G2_TARGET_GENERATED',
  'WT-COVERED-TARGET-TEST',
  'TGT-JAD-COVERED-001',
  '[]'::jsonb,
  5,
  'C2_CONFIDENTIAL_TECHNICAL',
  'ACTIVE',
  '{"decision_leverage":"COVERED_TARGET_TEST","historical_grade_not_drill_ready":true}'::jsonb
)
ON CONFLICT (profile_id) DO UPDATE SET
  configured_gate = EXCLUDED.configured_gate,
  workflow_template_code = EXCLUDED.workflow_template_code,
  pilot_status = EXCLUDED.pilot_status,
  configuration = EXCLUDED.configuration;

INSERT INTO qassas_security.role_assignment (
  role_assignment_id, user_id, role_type, asset_scope, jv_scope,
  decision_class_scope, capital_threshold, security_clearance,
  effective_from, effective_to, status
) VALUES
(
  'RA-CP-UHM-001', 'USR-CP-001', 'RESOURCE_GEOLOGIST_CP',
  '["LIC-UHM-001"]'::jsonb, '[]'::jsonb, '["MRE_READINESS"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-GEO-UHM-001', 'USR-GEO-001', 'SENIOR_GEOLOGIST',
  '["LIC-UHM-001"]'::jsonb, '[]'::jsonb, '["MRE_READINESS"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-EXP-UHM-001', 'USR-EXP-001', 'EXPLORATION_DIRECTOR',
  '["LIC-UHM-001"]'::jsonb, '[]'::jsonb, '["MRE_READINESS"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-GEO-AG-001', 'USR-GEO-001', 'SENIOR_GEOLOGIST',
  '["LIC-ALGODEYER-001"]'::jsonb, '[]'::jsonb, '["INCREMENTAL_RESOURCE_VALUE"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-EXP-AG-001', 'USR-EXP-001', 'EXPLORATION_DIRECTOR',
  '["LIC-ALGODEYER-001"]'::jsonb, '[]'::jsonb, '["INCREMENTAL_RESOURCE_VALUE"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-GEO-JAD-001', 'USR-GEO-001', 'SENIOR_GEOLOGIST',
  '["LIC-JADIB-001"]'::jsonb, '[]'::jsonb, '["COVERED_TARGET_TEST"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-EXP-JAD-001', 'USR-EXP-001', 'EXPLORATION_DIRECTOR',
  '["LIC-JADIB-001"]'::jsonb, '[]'::jsonb, '["COVERED_TARGET_TEST"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-FIN-UHM-001', 'USR-FIN-001', 'FINANCE_REVIEWER',
  '["LIC-UHM-001"]'::jsonb, '[]'::jsonb, '["MRE_READINESS"]'::jsonb,
  2000000, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-FIN-AHN-001', 'USR-FIN-001', 'FINANCE_REVIEWER',
  '["LIC-AHN-001"]'::jsonb, '["JV-AHN-001"]'::jsonb, '["MULTI_TARGET_PORTFOLIO"]'::jsonb,
  2000000, 'C3_COMMERCIAL_JV_RESTRICTED', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-FIN-AG-001', 'USR-FIN-001', 'FINANCE_REVIEWER',
  '["LIC-ALGODEYER-001"]'::jsonb, '[]'::jsonb, '["INCREMENTAL_RESOURCE_VALUE"]'::jsonb,
  2000000, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-FIN-JAD-001', 'USR-FIN-001', 'FINANCE_REVIEWER',
  '["LIC-JADIB-001"]'::jsonb, '[]'::jsonb, '["COVERED_TARGET_TEST"]'::jsonb,
  2000000, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
)
ON CONFLICT DO NOTHING;

COMMIT;
