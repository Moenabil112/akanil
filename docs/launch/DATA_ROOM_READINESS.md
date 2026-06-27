# Akanil — Data Room Readiness Checklist

## Access model

- [ ] Five access levels confirmed: public → institutional_brief → nda_data_room
      → technical_review → partner_internal.
- [ ] Window permissions seeded for initial institutional users.
- [ ] NDA workflow states understood: pending → sent → signed → approved.

## Documents

- [ ] Document metadata complete (title, window, type, sensitivity, access level,
      language, version, status, owner, review/expiry, approver, related entity, tags).
- [ ] Files uploaded to the private bucket; storage paths never exposed.
- [ ] Each document classified at the correct access level.
- [ ] Sensitive documents gated behind NDA approval.

## Verification

- [ ] Test user with institutional_brief sees only public + brief documents.
- [ ] Test user without approved NDA cannot see NDA-level documents.
- [ ] Admin (data room manager) sees all active documents.
- [ ] Locked documents are visible as "locked" without revealing paths.
- [ ] Downloads generate short-lived signed URLs and are logged.

## Operations

- [ ] Admin can grant/revoke window access and update NDA status.
- [ ] Download log reviewed regularly.
- [ ] Expiring access reviewed (expiry dates / `access expiring soon` email).
