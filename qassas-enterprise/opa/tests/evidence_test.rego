package qassas.evidence_test

import data.qassas.evidence

base_subject(role_type, asset_scope) := {
  "user_id": "USR-TEST",
  "role_assignments": [{
    "role_type": role_type,
    "status": "ACTIVE",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": null,
    "asset_scope": asset_scope
  }]
}

test_senior_geologist_can_register_scoped_evidence if {
  result := evidence.decision with input as {
    "action": "register",
    "subject": base_subject("SENIOR_GEOLOGIST", ["LIC-ABUSALAL-001"]),
    "object": {"asset_id": "LIC-ABUSALAL-001"}
  }
  result.allow == true
}

test_partner_cannot_qualify_evidence if {
  result := evidence.decision with input as {
    "action": "qualify",
    "subject": base_subject("PARTNER_USER", ["LIC-ABUSALAL-001"]),
    "object": {"asset_id": "LIC-ABUSALAL-001"}
  }
  result.allow == false
}

test_system_admin_is_not_evidence_authority if {
  result := evidence.decision with input as {
    "action": "open_conflict",
    "subject": base_subject("SYSTEM_ADMIN", ["LIC-ABUSALAL-001"]),
    "object": {"asset_id": "LIC-ABUSALAL-001"}
  }
  result.allow == false
}

test_out_of_scope_geologist_is_denied if {
  result := evidence.decision with input as {
    "action": "create_snapshot",
    "subject": base_subject("SENIOR_GEOLOGIST", ["LIC-AHN-001"]),
    "object": {"asset_id": "LIC-ABUSALAL-001"}
  }
  result.allow == false
}
