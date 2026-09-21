package qassas.target_test

import data.qassas.target

test_partner_allowed_for_assigned_asset if {
  result := target.decision with input as {
    "action": "read",
    "subject": {
      "role_assignments": [{
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-AHN-001"]
      }]
    },
    "object": {
      "asset_id": "LIC-AHN-001"
    }
  }
  result.allow == true
}

test_partner_denied_for_unrelated_asset if {
  result := target.decision with input as {
    "action": "read",
    "subject": {
      "role_assignments": [{
        "status": "ACTIVE",
        "effective_from": "2026-01-01T00:00:00Z",
        "effective_to": null,
        "asset_scope": ["LIC-AHN-001"]
      }]
    },
    "object": {
      "asset_id": "LIC-ABUSALAL-001"
    }
  }
  result.allow == false
}
