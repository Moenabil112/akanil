package qassas.evidence

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

technical_evidence_role(ra) if {
  ra.role_type == "SENIOR_GEOLOGIST"
}

technical_evidence_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

base_scope(ra) if {
  active_role(ra)
  business_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
}

allow if {
  input.action in {
    "register",
    "qualify",
    "create_snapshot",
    "open_gap",
    "open_conflict"
  }
  some ra in input.subject.role_assignments
  base_scope(ra)
  technical_evidence_role(ra)
}

decision := {
  "allow": allow,
  "reason": reason,
}

reason := "EVIDENCE_ACTION_AUTHORISED" if allow
reason := "EVIDENCE_ACTION_DENIED" if not allow
