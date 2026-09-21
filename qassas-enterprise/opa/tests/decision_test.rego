package qassas.decision_test

import data.qassas.decision

base_object := {
  "asset_id": "LIC-ABUSALAL-001",
  "decision_class": "DISCOVERY_REVIEW",
  "created_by_user_id": "USR-GEO-001"
}

test_senior_geologist_can_open_scoped_decision if {
  result := decision.decision with input as {
    "action": "open",
    "subject": {
      "user_id": "USR-GEO-001",
      "role_assignments": [{
        "role_type": "SENIOR_GEOLOGIST",
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-ABUSALAL-001"],
        "decision_class_scope": ["DISCOVERY_REVIEW"]
      }]
    },
    "object": base_object
  }
  result.allow == true
}

test_creator_cannot_self_approve if {
  result := decision.decision with input as {
    "action": "approve",
    "subject": {
      "user_id": "USR-GEO-001",
      "role_assignments": [{
        "role_type": "EXPLORATION_DIRECTOR",
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-ABUSALAL-001"],
        "decision_class_scope": ["DISCOVERY_REVIEW"]
      }]
    },
    "object": base_object
  }
  result.allow == false
}

test_exploration_director_can_approve_other_authors_decision if {
  result := decision.decision with input as {
    "action": "approve",
    "subject": {
      "user_id": "USR-EXP-001",
      "role_assignments": [{
        "role_type": "EXPLORATION_DIRECTOR",
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-ABUSALAL-001"],
        "decision_class_scope": ["DISCOVERY_REVIEW"]
      }]
    },
    "object": base_object
  }
  result.allow == true
}

test_system_admin_cannot_approve if {
  result := decision.decision with input as {
    "action": "approve",
    "subject": {
      "user_id": "USR-ADMIN-001",
      "role_assignments": [{
        "role_type": "SYSTEM_ADMIN",
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-ABUSALAL-001"],
        "decision_class_scope": ["DISCOVERY_REVIEW"]
      }]
    },
    "object": base_object
  }
  result.allow == false
}
