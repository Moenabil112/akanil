BEGIN;

INSERT INTO qassas_core.enterprise (enterprise_id, name, status)
VALUES ('ENT-GMCO-001', 'GMCO Pilot Synthetic Enterprise', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO qassas_security.user_identity (user_id, external_subject, status) VALUES
('USR-GEO-001', '11111111-1111-4111-8111-111111111111', 'ACTIVE'),
('USR-EXP-001', '22222222-2222-4222-8222-222222222222', 'ACTIVE'),
('USR-ADMIN-001', '33333333-3333-4333-8333-333333333333', 'ACTIVE'),
('USR-PARTNER-001', '44444444-4444-4444-8444-444444444444', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO qassas_security.role_assignment (
  role_assignment_id, user_id, role_type, asset_scope, jv_scope,
  decision_class_scope, capital_threshold, security_clearance,
  effective_from, effective_to, status
) VALUES
(
  'RA-GEO-AS-001', 'USR-GEO-001', 'SENIOR_GEOLOGIST',
  '["LIC-ABUSALAL-001"]'::jsonb, '[]'::jsonb, '["DISCOVERY_REVIEW"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-EXP-AS-001', 'USR-EXP-001', 'EXPLORATION_DIRECTOR',
  '["LIC-ABUSALAL-001"]'::jsonb, '[]'::jsonb, '["DISCOVERY_REVIEW"]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-ADMIN-001', 'USR-ADMIN-001', 'SYSTEM_ADMIN',
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  NULL, 'C1_INTERNAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
),
(
  'RA-PARTNER-AHN-001', 'USR-PARTNER-001', 'PARTNER_USER',
  '["LIC-AHN-001"]'::jsonb, '["JV-AHN-001"]'::jsonb, '[]'::jsonb,
  NULL, 'C2_CONFIDENTIAL_TECHNICAL', '2026-01-01T00:00:00Z', NULL, 'ACTIVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_core.target (
  target_id, enterprise_id, prospect_id, asset_id, name,
  current_gate, operational_state, target_status, security_class
) VALUES (
  'TGT-AS-CORE-001',
  'ENT-GMCO-001',
  'PROS-AS-VMS-001',
  'LIC-ABUSALAL-001',
  'Abu Salal Synthetic VMS Core Target',
  'G6_DISCOVERY',
  'NORMAL_PROCESSING',
  'ACTIVE',
  'C2_CONFIDENTIAL_TECHNICAL'
) ON CONFLICT (target_id) DO UPDATE SET
  asset_id = EXCLUDED.asset_id,
  security_class = EXCLUDED.security_class;

INSERT INTO qassas_core.evidence_object (
  evidence_id, target_id, evidence_class, source_system, source_object_id,
  validation_status, decision_fitness, security_class, current_state
) VALUES
(
  'EV-AS-DRILL-001',
  'TGT-AS-CORE-001',
  'DRILLING',
  'SPRINT0_SYNTHETIC',
  'SYN-DRILL-001',
  'VALIDATED',
  'DECISION_GRADE',
  'C2_CONFIDENTIAL_TECHNICAL',
  'CURRENT'
),
(
  'EV-AS-GEOPHYS-001',
  'TGT-AS-CORE-001',
  'GEOPHYSICS',
  'SPRINT0_SYNTHETIC',
  'SYN-GEOPHYS-001',
  'VALIDATED',
  'QUALIFIED_WITH_LIMITATIONS',
  'C2_CONFIDENTIAL_TECHNICAL',
  'CURRENT'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_core.decision_object (
  decision_id, target_id, decision_class, decision_question,
  current_gate, trigger_type, state
) VALUES (
  'DEC-GMCO-002',
  'TGT-AS-CORE-001',
  'DISCOVERY_REVIEW',
  'Does current evidence justify progression toward resource-definition drilling?',
  'G6_DISCOVERY',
  'SPRINT0_ENGINEERING_PROOF',
  'CREATED'
) ON CONFLICT DO NOTHING;

COMMIT;
