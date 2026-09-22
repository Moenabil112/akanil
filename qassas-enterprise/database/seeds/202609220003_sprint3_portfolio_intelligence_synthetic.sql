BEGIN;

INSERT INTO qassas_security.user_identity (
  user_id, external_subject, status
) VALUES (
  'USR-PORTFOLIO-001',
  '77777777-7777-4777-8777-777777777777',
  'ACTIVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_security.role_assignment (
  role_assignment_id, user_id, role_type, asset_scope, jv_scope,
  decision_class_scope, capital_threshold, security_clearance,
  effective_from, effective_to, status
) VALUES (
  'RA-PORTFOLIO-GMCO-001',
  'USR-PORTFOLIO-001',
  'PORTFOLIO_EXECUTIVE',
  '["LIC-UHM-001","LIC-ABUSALAL-001","LIC-AHN-001","LIC-ALGODEYER-001","LIC-JADIB-001"]'::jsonb,
  '["JV-AHN-001"]'::jsonb,
  '["MRE_READINESS","DISCOVERY_REVIEW","MULTI_TARGET_PORTFOLIO","INCREMENTAL_RESOURCE_VALUE","COVERED_TARGET_TEST"]'::jsonb,
  NULL,
  'C3_COMMERCIAL_JV_RESTRICTED',
  '2026-01-01T00:00:00Z',
  NULL,
  'ACTIVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_core.portfolio_priority_assessment (
  assessment_id, profile_id, decision_id, model_version,
  geological_potential, evidence_confidence, technical_maturity,
  scale_potential, strategic_adjacency, cost_efficiency, data_quality,
  work_commitment_risk, partner_constraint,
  next_decision_cost_sar, expected_information_gain_points,
  rationale, assessed_by_user_id
) VALUES
(
  'PPA-UHM-001',
  'PILOT-ASSET-UHM',
  NULL,
  'PPI-0.1',
  85, 80, 80, 80, 75, 65, 78, 25, 10,
  1200000, 20,
  'Synthetic Sprint 3 assessment: high maturity/resource-readiness value with moderate cost-to-next-decision.',
  'USR-PORTFOLIO-001'
),
(
  'PPA-AS-001',
  'PILOT-ASSET-AS',
  NULL,
  'PPI-0.1',
  82, 72, 68, 78, 70, 75, 70, 30, 15,
  800000, 24,
  'Synthetic Sprint 3 assessment: strong discovery potential with high information leverage before broader resource drilling.',
  'USR-PORTFOLIO-001'
),
(
  'PPA-AHN-001',
  'PILOT-ASSET-AHN',
  NULL,
  'PPI-0.1',
  78, 55, 45, 90, 85, 60, 50, 40, 70,
  1500000, 30,
  'Synthetic Sprint 3 assessment: high scale and adjacency but material JV/partner constraint and lower evidence maturity.',
  'USR-PORTFOLIO-001'
),
(
  'PPA-AG-001',
  'PILOT-ASSET-AG',
  NULL,
  'PPI-0.1',
  74, 75, 85, 70, 65, 55, 80, 20, 10,
  2000000, 15,
  'Synthetic Sprint 3 assessment: mature resource-growth case requiring incremental value discipline before extension drilling.',
  'USR-PORTFOLIO-001'
),
(
  'PPA-JAD-001',
  'PILOT-ASSET-JAD',
  NULL,
  'PPI-0.1',
  65, 45, 30, 55, 60, 90, 40, 35, 10,
  300000, 28,
  'Synthetic Sprint 3 assessment: lower technical maturity but very high Value-of-Information efficiency for a covered-target test.',
  'USR-PORTFOLIO-001'
)
ON CONFLICT (assessment_id) DO NOTHING;

COMMIT;
