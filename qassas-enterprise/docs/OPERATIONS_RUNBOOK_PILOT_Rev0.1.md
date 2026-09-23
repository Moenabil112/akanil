# QASSAS Enterprise — Pilot Operations Runbook — Rev 0.1

## Operating principle

QASSAS is a governed decision-intelligence system. Operational availability does not change decision authority. Recommendations and scores remain advisory; controlled actions still require applicable rights, consent, capital and human-review gates.

## Pre-deployment

1. Identify the exact Git commit and set `QASSAS_RELEASE_ID`.
2. Set `QASSAS_ENVIRONMENT` to `test`, `uat` or `pilot`.
3. Supply environment-specific secrets outside the repository.
4. Run:
   `node scripts/ops-preflight.mjs <env-file>`
5. Confirm dependency-security CI has no unresolved Critical finding.
6. Confirm every High finding has a documented disposition.
7. Confirm migrations are reviewed before execution.
8. Confirm the Pilot/Production Keycloak realm excludes `qassas-cli`.

## Start order

1. PostgreSQL/PostGIS
2. Keycloak
3. OPA
4. Temporal
5. canonical migrations
6. Temporal worker
7. QASSAS API
8. outbox publisher verification

## Minimum health verification

- `GET /api/v1/health/live` → process alive.
- `GET /api/v1/health/ready` → database healthy.
- `GET /api/v1/health/business-controls` → database + Temporal + outbox acceptable.

Until O1 is complete, IAM and OPA fields marked `CONFIGURED_UNVERIFIED` are **not** sufficient for Pilot promotion.

## Smoke transaction

Execute the governed vertical slice using synthetic/non-production data:

Authenticated User
→ Authorised Command
→ Canonical Persistence
→ Durable Workflow
→ Human Review
→ Governed State Change
→ AuditEvent
→ Outbox Event
→ Read Model Update

Then execute the Sprint 1–3 regression suite.

## Stop / rollback conditions

Stop promotion immediately if any of the following occurs:
- authorization bypass;
- missing audit event for a controlled write;
- failed or stuck workflow affecting decision state;
- outbox degradation with lost/duplicated controlled event risk;
- stale or unapproved migration;
- score/recommendation alters authoritative decision state directly;
- rights/JV/capital/human gate can be bypassed.

Rollback is code/runtime rollback only. Never delete or rewrite append-only audit history to make a rollback appear clean.

## Incident evidence

Capture:
- environment;
- release ID / commit SHA;
- UTC timestamp;
- request/correlation identifier;
- actor/role;
- affected Asset / Decision / Gate identifiers;
- relevant AuditEvent identifiers;
- workflow identifiers;
- outbox state;
- database migration version;
- operator action taken.

## Pilot promotion rule

Pilot promotion requires:
- green Operational Readiness CI;
- SEC-00A disposition;
- O1 runtime readiness PASS;
- explicit human release approval.

Feature Sprint acceptance by itself is insufficient.
