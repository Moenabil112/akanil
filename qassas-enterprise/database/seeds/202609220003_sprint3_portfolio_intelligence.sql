BEGIN;

INSERT INTO qassas_security.user_identity (
  user_id, external_subject, status
) VALUES (
  'USR-PORT-001',
  '77777777-7777-4777-8777-777777777777',
  'ACTIVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO qassas_security.role_assignment (
  role_assignment_id, user_id, role_type, asset_scope, jv_scope,
  decision_class_scope, capital_threshold, security_clearance,
  effective_from, effective_to, status
) VALUES (
  'RA-PORT-GMCO-001',
  'USR-PORT-001',
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

INSERT INTO qassas_core.portfolio_scoring_model (
  model_code, model_version, model_name,
  w_geological_potential, w_evidence_confidence, w_technical_maturity,
  w_scale_potential, w_strategic_adjacency, w_cost_to_next_decision,
  w_work_commitment_risk, w_partner_constraint, w_data_quality,
  active, rationale
) VALUES (
  'PPI', 1, 'QASSAS Pilot Portfolio Priority Index Rev 0.1',
  0.18, 0.14, 0.12,
  0.12, 0.10, 0.10,
  0.08, 0.08, 0.08,
  true,
  'Transparent Pilot weighting. Negative dimensions are inverted. Score is advisory only and never authorises execution, gate transition, consent or capital.'
)
ON CONFLICT (model_code, model_version) DO NOTHING;

INSERT INTO qassas_core.target_assessment (
  assessment_id, target_id, assessment_version,
  geological_potential, evidence_confidence, technical_maturity,
  scale_potential, strategic_adjacency,
  cost_to_next_decision_score, work_commitment_risk_score,
  partner_constraint_score, data_quality,
  cost_to_next_decision_sar, expected_information_gain,
  rationale, assessed_by_user_id
) VALUES
(
  'TA-UHM-001', 'TGT-UHM-VMS-001', 1,
  82, 76, 72,
  80, 70,
  45, 30,
  15, 75,
  900000, 55,
  '{"synthetic":true,"basis":"Sprint 3 Pilot calibration only","note":"Not a resource estimate or investment valuation"}'::jsonb,
  'USR-EXP-001'
),
(
  'TA-AS-001', 'TGT-AS-CORE-001', 1,
  88, 70, 65,
  85, 75,
  55, 25,
  10, 72,
  1200000, 70,
  '{"synthetic":true,"basis":"Sprint 3 Pilot calibration only","note":"Core continuity remains a controlled uncertainty"}'::jsonb,
  'USR-EXP-001'
),
(
  'TA-AHN-001', 'TGT-AHN-PORT-001', 1,
  80, 55, 50,
  90, 85,
  60, 40,
  85, 58,
  1500000, 80,
  '{"synthetic":true,"basis":"Sprint 3 Pilot calibration only","note":"High partner-constraint score intentionally tests blocker/ranking separation"}'::jsonb,
  'USR-EXP-001'
),
(
  'TA-AG-001', 'TGT-AG-GROWTH-001', 1,
  78, 82, 85,
  74, 68,
  50, 20,
  10, 83,
  1800000, 45,
  '{"synthetic":true,"basis":"Sprint 3 Pilot calibration only","note":"Resource-growth economics remain separate from portfolio score"}'::jsonb,
  'USR-EXP-001'
),
(
  'TA-JAD-001', 'TGT-JAD-COVERED-001', 1,
  65, 45, 35,
  60, 55,
  30, 15,
  5, 50,
  350000, 85,
  '{"synthetic":true,"basis":"Sprint 3 Pilot calibration only","note":"High VoI potential does not make the target Drill Ready"}'::jsonb,
  'USR-EXP-001'
)
ON CONFLICT (assessment_id) DO NOTHING;

COMMIT;
