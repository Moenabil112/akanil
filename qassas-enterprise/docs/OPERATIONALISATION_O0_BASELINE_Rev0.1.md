# QASSAS Enterprise — Operationalisation O0 Baseline — Rev 0.1

**Status:** ACTIVE — BUILDING  
**Branch:** `qassas/operationalisation-o0-readiness`  
**Source baseline:** Sprint 3 — Portfolio Intelligence, Prioritisation & Control Board  
**Architecture constraint:** STEP 1 Architecture Lock remains binding.

## 1. Purpose

Operationalisation converts the governed pilot codebase into a controlled, repeatable and observable runtime without changing QASSAS decision authority.

This phase does **not** grant execution authority to scores, recommendations or AI outputs. Portfolio scoring remains advisory only. Rights, JV consent, capital controls, gate state and human approval remain authoritative controls.

## 2. O0 scope

O0 establishes the minimum repository-level operating contract:

1. explicit environment identity and release identity;
2. version-pinned runtime dependencies;
3. automated operational preflight;
4. dependency-security evidence capture;
5. an Operational Readiness CI gate independent of feature sprint CI;
6. a Pilot operations runbook;
7. explicit entry/exit criteria for TEST/UAT/Pilot.

## 3. Operational gates

### ORG-01 — Repository control
- Operational changes occur on a dedicated `qassas/operationalisation-*` branch.
- Sprint history is not rewritten.
- Deployment promotion must originate from an accepted commit.

### ORG-02 — Runtime identity
Every deployed environment must declare:
- `QASSAS_ENVIRONMENT`
- `QASSAS_RELEASE_ID`

Allowed environments:
`local | ci | test | uat | pilot | production`.

### ORG-03 — Runtime image control
Floating runtime tags are forbidden for TEST/UAT/Pilot/Production.

Initial O0 pins:
- PostGIS: `postgis/postgis:18-3.6`
- Keycloak: `quay.io/keycloak/keycloak:26.4`
- OPA: `openpolicyagent/opa:1.20.2`
- Temporal: `temporalio/auto-setup:1.32.0`

### ORG-04 — Security condition inheritance
SEC-00A #11 remains a deployment blocker until:
- full npm audit evidence is captured;
- Critical findings are zero;
- every High finding has a documented disposition;
- runtime images are pinned;
- the `qassas-cli` direct-grant client is absent from Pilot/Production realm configuration.

### ORG-05 — Readiness is not liveness
`/health/live` proves process liveness only.

Operational readiness requires, at minimum:
- database reachable;
- Temporal reachable;
- outbox publisher healthy;
- IAM configuration verified;
- OPA configuration verified;
- migrations current;
- security gate passed.

O0 introduces repository preflight. Runtime dependency verification is completed in O1.

## 4. Promotion states

`BUILDABLE → OPERATIONALLY_VALIDATED → TEST_READY → UAT_READY → PILOT_READY`

No state may be inferred from feature completeness alone.

## 5. O0 exit criteria

O0 is complete only when:
- Operational Readiness CI is green;
- pinned images are in the environment baseline;
- security audit evidence is produced by CI;
- Pilot runbook exists;
- SEC-00A remaining High findings are classified;
- O1 runtime readiness work is authorized.

## 6. Next phase

**O1 — Runtime Readiness & Control-Plane Verification**

Planned O1 work:
- IAM and OPA active health checks;
- migration/version readiness;
- release metadata endpoint;
- structured runtime health contract;
- startup fail-fast for invalid protected-environment configuration;
- TEST environment deployment manifest.
