# QASSAS Enterprise — Operationalisation O1 Runtime Readiness — Rev 0.1

**Status:** ACTIVE — VALIDATION IN CI  
**Parent:** Operationalisation O0 Baseline Rev 0.1  
**Architecture:** STEP 1 Architecture Lock remains binding.

## 1. Objective

Convert QASSAS readiness from configuration claims into active runtime verification across the control plane.

O1 does not introduce new business decision authority. It operationalises the existing governed architecture.

## 2. Implemented controls

### O1-R01 — Protected-environment fail-fast
The API validates protected environments before starting.

For TEST/UAT/Pilot/Production:
- release identity is mandatory;
- placeholder secrets are rejected;
- localhost control-plane endpoints are rejected;
- required migration identity is mandatory.

### O1-R02 — Active IAM readiness
Keycloak readiness is verified through its OpenID Connect discovery document.

### O1-R03 — Active OPA readiness
OPA readiness is verified through the OPA health endpoint.

### O1-R04 — Temporal readiness
Temporal remains actively verified through GetSystemInfo.

The repository Local/CI harness is pinned to `temporalio/auto-setup:1.29.7`. Because auto-setup is deprecated, protected environments are explicitly forbidden from using it. O2 supplies the supported Temporal Server/Cloud deployment profile.

### O1-R05 — Canonical migration readiness
The API checks that the required canonical migration exists in qassas_core.schema_migration.

Current required migration:
`202609220018_sprint3_jv_constraint_fallback.sql`

### O1-R06 — Outbox readiness
Controlled writes are not considered ready when the outbox publisher is disabled or degraded.

### O1-R07 — Release identity
Runtime endpoints expose:
- QASSAS environment;
- release ID;
- service version;
- Node runtime version.

### O1-R08 — HTTP readiness semantics
`GET /api/v1/health/ready` returns a failure response when the control plane is not ready.

Readiness requires:
- database;
- migrations;
- IAM;
- OPA;
- Temporal;
- outbox.

### O1-R09 — Environment-separated IAM profiles
Local/CI keeps the synthetic direct-grant client for test automation.

Pilot and Production profiles:
- contain no `qassas-cli`;
- contain no direct-access grant client;
- contain no synthetic users.

### O1-R10 — Live runtime CI
Operational CI now boots the local control plane, applies canonical migrations, starts QASSAS API, and verifies:
- /health/ready;
- /health/business-controls;
- /health/release.

## 3. Security evidence

The first O0 audit evidence reported:
- Critical: 0
- High: 0
- Moderate: 0
- Low: 0
- Total dependencies: 278

The historical three High findings recorded by SEC-00A are therefore not reproduced by the current dependency resolution.

Because the repository did not previously contain a package-lock.json, this is not treated as sufficient evidence of deterministic remediation. O1 therefore requires dependency locking and migration from `npm install` to `npm ci`.

## 4. O1 exit criteria

O1 is PASS only when:
- active runtime-readiness CI passes;
- package-lock.json is committed;
- operational CI and Sprint regression CI use `npm ci`;
- audit remains free of Critical findings;
- any High finding is explicitly dispositioned;
- Pilot/Production realm profiles pass preflight;
- Sprint 3 regression remains green under pinned Local/CI runtimes.

## 5. Next phase

**O2 — TEST Deployment & Observability Baseline**

Planned scope:
- supported Temporal Server/Cloud TEST profile;
- deployable TEST profile;
- structured logs and correlation IDs;
- operational metrics/SLO baseline;
- failure/recovery drills;
- backup/restore proof;
- migration promotion/rollback procedure;
- release promotion evidence bundle.
