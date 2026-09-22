package qassas.capital_test

import data.qassas.capital

subject(role_type, threshold) := {
  "user_id": "USR-TEST",
  "role_assignments": [{
    "role_type": role_type,
    "status": "ACTIVE",
    "effective_from": "2026-01-01T00:00:00Z",
    "effective_to": null,
    "asset_scope": ["LIC-ABUSALAL-001"],
    "capital_threshold": threshold
  }]
}

object := {
  "asset_id": "LIC-ABUSALAL-001",
  "requested_amount": 500000
}

test_geologist_can_request_capital if {
  result := capital.decision with input as {
    "action": "request",
    "subject": subject("SENIOR_GEOLOGIST", null),
    "object": object
  }
  result.allow == true
}

test_finance_can_approve if {
  result := capital.decision with input as {
    "action": "approve",
    "subject": subject("FINANCE_REVIEWER", 2000000),
    "object": object
  }
  result.allow == true
}

test_system_admin_cannot_release if {
  result := capital.decision with input as {
    "action": "release",
    "subject": subject("SYSTEM_ADMIN", 999999999),
    "object": object
  }
  result.allow == false
}
