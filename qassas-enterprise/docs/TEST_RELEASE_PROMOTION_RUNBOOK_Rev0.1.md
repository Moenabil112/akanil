# QASSAS Enterprise — TEST Release Promotion & Recovery Runbook — Rev 0.1

## Release inputs

A TEST release must identify:
- Git commit SHA;
- QASSAS release ID;
- required canonical migration;
- exact container/runtime versions;
- CI evidence bundle.

## Promotion sequence

1. Run locked dependency installation with `npm ci`.
2. Run typecheck and build.
3. Run protected TEST preflight.
4. Render and validate the TEST Compose model.
5. Start persistence and control-plane services.
6. Apply Temporal persistence schema through the pinned Admin Tools image.
7. Start the pinned Temporal Server image.
8. Create/verify the QASSAS TEST namespace.
9. Apply QASSAS canonical migrations.
10. Start QASSAS API and Temporal worker.
11. Require active readiness PASS.
12. Run TEST SLO gate.
13. Run OPA fail-closed/recovery drill.
14. Create and restore-verify a QASSAS database backup.
15. Produce the promotion evidence bundle.

## Stop-promotion conditions

Do not promote when any of the following is observed:
- database migration identity mismatch;
- Keycloak, OPA or Temporal not actively reachable;
- outbox degraded or disabled;
- controlled writes remain ready during an OPA outage;
- backup cannot be restored;
- required migration is absent after restore;
- release identity differs from the deployed commit;
- Sprint regression is red;
- any score/recommendation bypasses authoritative decision gates.

## Application rollback

Application rollback is permitted only when the target release is schema-compatible with the currently applied canonical migration set.

Rollback procedure:
1. stop new promotion;
2. preserve logs, AuditEvents, workflow IDs and outbox state;
3. redeploy the previous compatible application image;
4. verify active readiness;
5. execute governed smoke tests;
6. document the incident and release transition.

## Database recovery

Database restore is reserved for verified persistence loss/corruption or an approved recovery exercise.

Before restoration:
- preserve the affected database where possible;
- capture release ID and migration state;
- capture AuditEvent and outbox evidence;
- obtain explicit operational approval.

After restoration:
- verify required migration;
- verify audit schema;
- verify outbox health;
- verify Temporal connectivity;
- run active readiness and governed smoke flow.

Never rewrite or delete append-only audit history as a rollback shortcut.

## Evidence retention

The CI bundle under `artifacts/o2` is the minimum TEST promotion record.

A promotion decision should reference the exact CI run and Git commit that produced the evidence.
