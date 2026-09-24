# SEC-00A — Dependency & Runtime Hardening Disposition — Rev 0.1

**Issue:** #11  
**Status:** CONDITIONAL — LOCKFILE AND FINAL O1 CI REQUIRED  
**Scope:** QASSAS Enterprise Operationalisation

## Evidence observed

Operational Readiness CI generated a full npm audit report for the current QASSAS workspace.

Result:
- Critical: 0
- High: 0
- Moderate: 0
- Low: 0
- Total dependencies: 278

The three High findings originally recorded in SEC-00A are not reproduced by the current resolution.

## Reproducibility finding

The QASSAS Enterprise workspace did not contain a committed package-lock.json when the audit was captured.

Therefore:
- the current zero-vulnerability result is valid evidence for that CI resolution;
- it is not yet sufficient proof that future installs will resolve the identical dependency graph;
- SEC-00A must remain open until the generated lockfile is committed and CI is converted to `npm ci`.

## Runtime image disposition

Floating runtime tags have been removed from the Local/CI operational baseline.

Pinned Local/CI versions:
- PostGIS: postgis/postgis:18-3.6
- Keycloak: quay.io/keycloak/keycloak:26.4
- OPA: openpolicyagent/opa:1.20.2
- Temporal Local/CI harness: temporalio/auto-setup:1.29.7

The Temporal auto-setup image is deprecated and is therefore **not accepted** for TEST/UAT/Pilot/Production. Operational preflight rejects it in protected environments. A supported Temporal Server/Cloud deployment must be pinned in the O2 deployment profile before SEC-00A can be fully closed for Pilot promotion.

## IAM direct-grant disposition

Local/CI realm:
- retains `qassas-cli` solely for automated test flows.

Pilot/Production realm profiles:
- exclude `qassas-cli`;
- exclude direct access grants;
- exclude synthetic test users.

Operational preflight fails Pilot/Production if a protected realm profile contains `qassas-cli` or any direct-access grant client.

## Closure requirements

SEC-00A may be closed when:
1. package-lock.json is committed;
2. relevant CI uses `npm ci`;
3. locked dependency audit has no unresolved Critical finding;
4. any High finding in the locked graph has a documented disposition;
5. O1 runtime readiness CI passes;
6. Sprint regression passes under the pinned Local/CI baseline;
7. protected environment deployment uses a supported pinned Temporal Server/Cloud profile.
