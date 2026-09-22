package qassas.capital

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

business_role(ra) if {
  ra.role_type != "SYSTEM_ADMIN"
}

request_role(ra) if {
  ra.role_type == "SENIOR_GEOLOGIST"
}

request_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

assessment_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

assessment_role(ra) if {
  ra.role_type == "FINANCE_REVIEWER"
}

finance_role(ra) if {
  ra.role_type == "FINANCE_REVIEWER"
}

base_scope(ra) if {
  active_role(ra)
  business_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
}

allow if {
  input.action == "request"
  some ra in input.subject.role_assignments
  base_scope(ra)
  request_role(ra)
}

allow if {
  input.action == "assess"
  some ra in input.subject.role_assignments
  base_scope(ra)
  assessment_role(ra)
}

allow if {
  input.action in {"approve", "release", "return"}
  some ra in input.subject.role_assignments
  base_scope(ra)
  finance_role(ra)
}

decision := {
  "allow": allow,
  "reason": reason,
}

reason := "CAPITAL_ACTION_AUTHORISED" if allow
reason := "CAPITAL_ACTION_DENIED" if not allow
