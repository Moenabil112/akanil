# Akanil — Admin Operations Checklist

## Roles

| Role | Can do |
|---|---|
| Super Admin | Everything, including role assignment |
| Platform Admin | Everything except destructive platform config; assign roles |
| Data Room Manager | Documents, NDA status, window-access grants |
| Content Manager | Content / CMS |
| Reviewer | Review and update request statuses |
| Viewer | Read-only |

## Daily / routine operations

- [ ] Review new access requests (Approve / Decline with confirmation).
- [ ] Review briefing, contact, and QASSAS demo requests.
- [ ] Update NDA status as agreements progress (pending → sent → signed → approved).
- [ ] Grant window access at the appropriate level after approval.
- [ ] Add / update document metadata; upload files to the private bucket.
- [ ] Review the download log for unexpected activity.

## Filtering & search

- [ ] Requests: filter by status, search by name / email / organization.
- [ ] Documents: filter by window, type, sensitivity, access level, status, language.

## Safety

- [ ] Approve / decline require explicit confirmation.
- [ ] Every status change, role change, NDA change, and grant is written to the
      audit log.
- [ ] Only Platform Admin+ can change roles; self role-escalation is blocked.

## Incident response

- [ ] Revoke window access or set NDA to `revoked` to cut off access immediately.
- [ ] Set documents `is_active = false` to remove from listings.
- [ ] Review `audit_logs` and `document_access_logs` for the timeline.
