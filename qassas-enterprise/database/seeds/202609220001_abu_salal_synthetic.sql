BEGIN;

INSERT INTO qassas_core.enterprise (enterprise_id, name, status)
VALUES ('ENT-GMCO-001', 'GMCO Pilot Synthetic Enterprise', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO qassas_core.target (
  target_id, enterprise_id, prospect_id, name, current_gate, operational_state, target_status
) VALUES (
  'TGT-AS-CORE-001',
  'ENT-GMCO-001',
  'PROS-AS-VMS-001',
  'Abu Salal Synthetic VMS Core Target',
  'G6_DISCOVERY',
  'NORMAL_PROCESSING',
  'ACTIVE'
) ON CONFLICT DO NOTHING;

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
