# QASSAS Enterprise — Sprint 0

This subtree implements the QASSAS Enterprise Pilot Build Foundation defined by BF-01.

## Sprint 0 objective

Prove one governed engineering transaction:

```
Authenticated User
→ Authorised Command
→ Canonical Persistence
→ Durable Workflow
→ Human Review
→ Governed State Change
→ AuditEvent
→ Outbox Event
→ Read Model Update
```

The first vertical slice is **Abu Salal — Discovery-to-Resource**.

## Architecture baseline

- Core: TypeScript / NestJS modular monolith
- Database: PostgreSQL 18 + PostGIS 3.6
- Workflow: Temporal
- Identity: Keycloak reference IdP
- Authorization: OPA + QASSAS RoleAssignment
- Audit: append-only AuditEvent
- Events: transactional outbox
- AI: explicitly outside Sprint 0

## Local bootstrap

1. Copy `.env.example` to `.env`.
2. Start dependencies: `docker compose -f infra/local/docker-compose.yml up -d`.
3. Install: `npm install`.
4. Build: `npm run build`.
5. Run OPA tests using the official OPA container.
6. Apply SQL migrations, then the synthetic Abu Salal seed.

See `docs/E2E-BF01-001.md` for the first engineering proof.

> This Sprint 0 code is isolated from the existing AKANIL web application. Legacy ZYNTRA-labelled website routes are not part of this implementation baseline.
