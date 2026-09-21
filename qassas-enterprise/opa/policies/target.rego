package qassas.target

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

allow if {
  input.action == "read"
  some ra in input.subject.role_assignments
  active_role(ra)
  business_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
}

decision := {
  "allow": allow,
  "reason": reason,
}

reason := "OBJECT_WITHIN_AUTHORISED_SCOPE" if allow
reason := "OBJECT_OUTSIDE_AUTHORISED_SCOPE" if not allow
