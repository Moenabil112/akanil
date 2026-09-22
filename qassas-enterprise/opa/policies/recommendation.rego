package qassas.recommendation

default allow := false

active_role(ra) if {
  ra.status == "ACTIVE"
  time.now_ns() >= time.parse_rfc3339_ns(ra.effective_from)
  not expired(ra)
}

expired(ra) if {
  ra.effective_to != null
  time.now_ns() > time.parse_rfc3339_ns(ra.effective_to)
}

scope_contains(scope, value) if {
  some i
  scope[i] == value
}

decision_scope_contains(scope, value) if {
  some i
  scope[i] == value
}

business_role(ra) if {
  ra.role_type != "SYSTEM_ADMIN"
}

technical_role(ra) if {
  ra.role_type == "SENIOR_GEOLOGIST"
}

technical_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

allow if {
  input.action in {
    "create_action",
    "propose_test",
    "issue_recommendation"
  }
  some ra in input.subject.role_assignments
  active_role(ra)
  business_role(ra)
  technical_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
  decision_scope_contains(ra.decision_class_scope, input.object.decision_class)
}

decision := {
  "allow": allow,
  "reason": reason,
}

reason := "RECOMMENDATION_ACTION_AUTHORISED" if allow
reason := "RECOMMENDATION_ACTION_DENIED" if not allow
