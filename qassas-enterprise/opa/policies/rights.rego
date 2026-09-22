package qassas.rights

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

technical_admin_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

technical_read_role(ra) if {
  ra.role_type == "SENIOR_GEOLOGIST"
}

technical_read_role(ra) if {
  ra.role_type == "EXPLORATION_DIRECTOR"
}

allow if {
  input.action in {
    "register_licence",
    "add_party_role",
    "define_jv_constraint",
    "create_work_commitment",
    "update_work_commitment",
    "assess_constraints"
  }
  some ra in input.subject.role_assignments
  active_role(ra)
  business_role(ra)
  technical_admin_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
}

allow if {
  input.action == "read_rights"
  some ra in input.subject.role_assignments
  active_role(ra)
  business_role(ra)
  technical_read_role(ra)
  scope_contains(ra.asset_scope, input.object.asset_id)
}

allow if {
  input.action == "read_rights"
  some ra in input.subject.role_assignments
  active_role(ra)
  ra.role_type == "PARTNER_USER"
  scope_contains(ra.asset_scope, input.object.asset_id)
  scope_contains(ra.jv_scope, input.object.jv_id)
}

allow if {
  input.action == "record_consent"
  some ra in input.subject.role_assignments
  active_role(ra)
  ra.role_type == "PARTNER_USER"
  scope_contains(ra.asset_scope, input.object.asset_id)
  scope_contains(ra.jv_scope, input.object.jv_id)
}

decision := {
  "allow": allow,
  "reason": reason,
}

reason := "RIGHTS_ACTION_AUTHORISED" if allow
reason := "RIGHTS_ACTION_DENIED" if not allow
