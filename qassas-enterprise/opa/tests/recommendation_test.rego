package qassas.recommendation_test

import data.qassas.recommendation

subject(role_type, asset_scope) := {
  "user_id": "USR-TEST",
  "role_assignments": [{
    "role_type": role_type,
    "status": "ACTIVE",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": null,
    "asset_scope": asset_scope,
    "decision_class_scope": ["DISCOVERY_REVIEW"]
  }]
}

object := {
  "asset_id": "LIC-ABUSALAL-001",
  "decision_class": "DISCOVERY_REVIEW"
}

test_geologist_can_propose_next_best_test if {
  result := recommendation.decision with input as {
    "action": "propose_test",
    "subject": subject("SENIOR_GEOLOGIST", ["LIC-ABUSALAL-001"]),
    "object": object
  }
  result.allow == true
}

test_director_can_issue_recommendation if {
  result := recommendation.decision with input as {
    "action": "issue_recommendation",
    "subject": subject("EXPLORATION_DIRECTOR", ["LIC-ABUSALAL-001"]),
    "object": object
  }
  result.allow == true
}

test_system_admin_cannot_issue_recommendation if {
  result := recommendation.decision with input as {
    "action": "issue_recommendation",
    "subject": subject("SYSTEM_ADMIN", ["LIC-ABUSALAL-001"]),
    "object": object
  }
  result.allow == false
}

test_partner_cannot_create_candidate_action if {
  result := recommendation.decision with input as {
    "action": "create_action",
    "subject": subject("PARTNER_USER", ["LIC-ABUSALAL-001"]),
    "object": object
  }
  result.allow == false
}
