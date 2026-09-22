package qassas.rights_test

import data.qassas.rights

subject(user_id, role_type, asset_scope, jv_scope) := {
  "user_id": user_id,
  "role_assignments": [{
    "role_type": role_type,
    "status": "ACTIVE",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": null,
    "asset_scope": asset_scope,
    "jv_scope": jv_scope
  }]
}

object := {
  "asset_id": "LIC-AHN-001",
  "jv_id": "JV-AHN-001"
}

test_director_can_register_scoped_licence if {
  result := rights.decision with input as {
    "action": "register_licence",
    "subject": subject(
      "USR-EXP-001",
      "EXPLORATION_DIRECTOR",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": object
  }
  result.allow == true
}

test_geologist_can_read_but_not_register if {
  read_result := rights.decision with input as {
    "action": "read_rights",
    "subject": subject(
      "USR-GEO-001",
      "SENIOR_GEOLOGIST",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": object
  }
  read_result.allow == true

  write_result := rights.decision with input as {
    "action": "register_licence",
    "subject": subject(
      "USR-GEO-001",
      "SENIOR_GEOLOGIST",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": object
  }
  write_result.allow == false
}

test_partner_can_record_consent_only_inside_jv_scope if {
  result := rights.decision with input as {
    "action": "record_consent",
    "subject": subject(
      "USR-PARTNER-001",
      "PARTNER_USER",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": object
  }
  result.allow == true
}

test_partner_cannot_record_other_jv_consent if {
  result := rights.decision with input as {
    "action": "record_consent",
    "subject": subject(
      "USR-PARTNER-001",
      "PARTNER_USER",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": {
      "asset_id": "LIC-AHN-001",
      "jv_id": "JV-OTHER-001"
    }
  }
  result.allow == false
}

test_system_admin_is_not_rights_authority if {
  result := rights.decision with input as {
    "action": "register_licence",
    "subject": subject(
      "USR-ADMIN-001",
      "SYSTEM_ADMIN",
      ["LIC-AHN-001"],
      ["JV-AHN-001"]
    ),
    "object": object
  }
  result.allow == false
}
