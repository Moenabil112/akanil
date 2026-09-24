# QASSAS Enterprise — Operationalisation O2 TEST Deployment & Observability — Rev 0.1

**Status:** ACTIVE — EXECUTION  
**Parent state:** OPERATIONALLY_VALIDATED  
**Target state:** TEST_READY  
**Architecture constraint:** STEP 1 Architecture Lock remains binding.

## 1. Objective

O2 converts the validated repository/control-plane baseline into a deployable TEST environment with measurable operational behaviour and evidence-backed promotion controls.

O2 does not change decision authority. Scores and recommendations remain advisory only. Rights, JV consent, capital controls, gate state and human approval remain authoritative.

## 2. TEST deployment baseline

The TEST profile is defined under `infra/test`.

Runtime components:
- QASSAS API container;
- QASSAS Temporal worker container;
- dedicated QASSAS PostgreSQL/PostGIS persistence;
- dedicated Temporal PostgreSQL persistence;
- Temporal Server;
- Temporal Admin Tools for explicit schema management;
- Keycloak TEST identity service;
- OPA policy engine.

Temporal TEST uses:
- `temporalio/server:1.32.0`;
- `temporalio/admin-tools:1.32.0`;
- `postgres:16.15-alpine3.23`.

The deprecated `temporalio/auto-setup` image remains forbidden for TEST/UAT/Pilot/Production.

## 3. Observability contract

Every HTTP request receives a correlation ID.

Accepted inbound `x-correlation-id` values are preserved when they match the controlled format; otherwise QASSAS generates a UUID.

The API emits one structured JSON completion log per request containing:
- timestamp;
- service;
- environment;
- release ID;
- correlation ID;
- method;
- path without query string;
- status code;
- duration.

Request bodies, bearer tokens and query parameters are not written into the structured request log.

TEST metrics are available from:
`GET /api/v1/observability/metrics`

The current metrics scope is explicitly:
`PROCESS_LOCAL_TEST_BASELINE`

It is not yet a multi-instance production telemetry backend.

## 4. TEST SLO gate

O2 CI generates traffic and verifies:
- active readiness PASS;
- minimum latency sample count;
- p95 API latency <= configured TEST threshold;
- 5xx ratio <= configured TEST threshold.

Initial TEST thresholds:
- p95 <= 1000 ms;
- 5xx ratio <= 1%;
- minimum 25 controlled smoke samples.

These are TEST promotion thresholds, not external customer SLAs.

## 5. Fail-closed recovery drill

The O2 gate intentionally removes OPA from the running control plane.

Expected behaviour:
1. readiness transitions from HTTP 200 to HTTP 503;
2. controlled-writes readiness becomes unavailable;
3. OPA is restarted;
4. readiness returns to HTTP 200.

A TEST deployment that remains ready while OPA is unavailable must fail O2.

## 6. Backup/restore proof

O2 creates a PostgreSQL custom-format backup of the QASSAS TEST database and restores it into an isolated verification database.

The restored copy must contain:
- the required canonical migration;
- the QASSAS audit schema.

The verification database is destroyed after the proof. The backup artifact is retained in the CI promotion evidence bundle.

## 7. Promotion evidence

O2 produces a hashed evidence bundle containing:
- readiness snapshot;
- business-control readiness snapshot;
- release identity;
- observability metrics;
- SLO evidence;
- failure/recovery evidence;
- backup/restore evidence;
- rendered Compose model;
- deployment state and logs.

## 8. Migration and rollback rule

Database migrations are forward-managed and remain canonical.

Application/runtime rollback is allowed only to a release compatible with the current schema.

A database restore is an incident/recovery action, not a normal release rollback mechanism.

Append-only audit history must never be edited or deleted to simulate rollback.

## 9. O2 exit criteria

O2 is PASS only when:
- O1 Operational Readiness remains green;
- Sprint 0–3 regression remains green;
- TEST Compose validates;
- TEST environment starts from a clean state;
- Temporal Server schema/namespace setup passes using supported images;
- API and worker start successfully;
- active readiness is healthy;
- SLO gate passes;
- fail-closed/recovery drill passes;
- backup/restore proof passes;
- promotion evidence bundle is complete.

Only then may the repository state move from:
`OPERATIONALLY_VALIDATED → TEST_READY`.
