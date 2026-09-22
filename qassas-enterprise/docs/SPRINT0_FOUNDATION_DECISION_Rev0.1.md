# QASSAS ENTERPRISE
## SPRINT0_FOUNDATION_DECISION
### Revision 0.1

**Programme:** QASSAS Enterprise — Enterprise Exploration Portfolio Operating System  
**Pilot:** QASSAS × GMCO Enterprise Exploration Portfolio Pilot  
**Source Specification:** BF-01 — QASSAS Pilot Sprint 0 Build Foundation Specification — Rev 0.1  
**Branch:** `qassas/sprint-0-foundation`  
**Draft PR:** #2 — QASSAS Sprint 0 — Build Foundation  
**Acceptance Run:** GitHub Actions — QASSAS Sprint 0 CI — Run #128  
**Run ID:** `35671326677`  
**Decision Date:** 2026-09-22

---

# 1. FORMAL DECISION

# READY_WITH_CONDITIONS

Sprint 0 has passed its architectural and end-to-end engineering proof.

The QASSAS Build Foundation is accepted as a valid baseline for continued Sprint 1 development.

This decision does **not** authorise Pilot/production deployment.

The conditions in Section 8 must be resolved or explicitly dispositioned before TEST/UAT/Pilot deployment.

---

# 2. ACCEPTED BUILD FOUNDATION

The accepted Sprint 0 foundation now includes:

- isolated `qassas-enterprise/` build boundary;
- NestJS modular-monolith API foundation;
- PostgreSQL/PostGIS canonical persistence;
- migration and synthetic seed runners;
- Keycloak reference identity realm;
- QASSAS effective-dated RoleAssignment;
- OPA contextual authorization;
- server-side default-deny object scoping;
- System Admin separation from business authority;
- DecisionObject governed commands;
- HumanReview;
- explicit approve/reject actions;
- Segregation of Duties;
- optimistic concurrency;
- command idempotency;
- append-only AuditEvent;
- audit hash chaining;
- transactional Outbox;
- idempotent consumer delivery;
- Decision read model;
- Temporal durable HumanReview workflow;
- Temporal client readiness probe;
- Temporal worker startup retry;
- Abu Salal synthetic vertical slice;
- GitHub Actions foundation and live E2E gates.

---

# 3. FOUNDATION GATE RESULT

GitHub Actions Run #128:

| Gate | Result |
|---|---|
| Install | PASS |
| Typecheck | PASS |
| Build | PASS |
| OPA Policy Tests | PASS |
| Foundation Job | PASS |

Foundation Job ID:

`106568215453`

---

# 4. E2E-BF01-001 RESULT

## RESULT: PASS

E2E Job ID:

`106568328745`

Observed sequence:

1. services became ready;
2. Keycloak issued real JWTs for synthetic Pilot identities;
3. Senior Geologist was authorised for Abu Salal target scope;
4. unrelated Partner User was denied;
5. System Admin was denied business-object access;
6. Senior Geologist opened a governed DecisionObject;
7. duplicate OpenDecision request returned the same governed result through idempotency;
8. HumanReview was requested;
9. Temporal HumanReview workflow was created;
10. Decision creator attempted self-approval and was denied;
11. Exploration Director approved independently;
12. stale-version approval was rejected;
13. Outbox events were published;
14. Decision read model reached APPROVED;
15. consumer delivery was idempotently recorded;
16. Audit hash chain was validated;
17. audit history was reconstructed;
18. Temporal workflow returned APPROVED.

---

# 5. E2E EXECUTION REFERENCES

Successful runtime objects:

**Decision ID**

`DEC-4a21c22a-2d77-48a4-a298-cc06f6f2478b`

**Human Review ID**

`REV-88fca56d-28ae-4fe5-aa7f-0b0de7dd1e7c`

**Temporal Workflow ID**

`qassas-review:DEC-4a21c22a-2d77-48a4-a298-cc06f6f2478b:REV-88fca56d-28ae-4fe5-aa7f-0b0de7dd1e7c`

---

# 6. GOVERNANCE CONTROLS PROVEN

## GC-01 — Authentication

Real Keycloak access tokens were used in the E2E run.

**Status: PASS**

## GC-02 — RoleAssignment

External identity was resolved to QASSAS User and active effective-dated RoleAssignments.

**Status: PASS**

## GC-03 — Object Scope

Abu Salal access was allowed only to scoped users.

Partner and System Admin business reads did not expose the target.

**Status: PASS**

## GC-04 — Segregation of Duties

Decision creator self-approval was denied.

**Status: PASS**

## GC-05 — Human Approval

Exploration Director completed the final governed review.

**Status: PASS**

## GC-06 — Optimistic Concurrency

Stale object version was rejected.

**Status: PASS**

## GC-07 — Idempotency

Duplicate Decision opening did not create a duplicate governed Decision.

**Status: PASS**

## GC-08 — Workflow Durability Boundary

Temporal orchestrated HumanReview while PostgreSQL retained canonical Decision truth.

**Status: PASS**

## GC-09 — Auditability

Audit history was append-only and hash-linked.

**Status: PASS**

## GC-10 — Transactional Event Boundary

Governed changes emitted Outbox records and derived read-model updates.

**Status: PASS**

---

# 7. BF-01 LOCK CANDIDATE DISPOSITION

| Lock Candidate | Disposition |
|---|---|
| BFL-01 Foundation before feature breadth | ACCEPTED |
| BFL-02 Abu Salal first vertical slice | PROVEN |
| BFL-03 Decision + Review + Audit + Outbox coherence | PROVEN |
| BFL-04 RoleAssignment + OPA server-side authorization | PROVEN |
| BFL-05 Keycloak is identity, not business authority | PROVEN |
| BFL-06 Temporal does not own canonical Decision truth | PROVEN |
| BFL-07 AuditEvent append-only | PROVEN |
| BFL-08 Transactional Outbox before distributed publishing | PROVEN |
| BFL-09 AI outside Sprint 0 | MAINTAINED |
| BFL-10 Sprint 1 requires E2E proof | SATISFIED |

---

# 8. CONDITIONS BEFORE TEST/UAT/PILOT DEPLOYMENT

## C-01 — Dependency Security Triage

Current GitHub Actions installation output reports:

**3 high severity vulnerabilities**

The current evidence does not establish their exploitability or whether they affect runtime paths.

Required action:

- capture full `npm audit` result;
- identify direct/transitive packages;
- classify runtime/dev exposure;
- remediate, upgrade, mitigate, or formally accept;
- introduce a CI dependency-security gate.

**Deployment Block:** TEST/UAT/Pilot until dispositioned.  
**Sprint 1 Development Block:** No.

---

## C-02 — Runtime Image Pinning

The local Sprint 0 configuration still permits moving image tags for selected supporting services such as OPA/Temporal.

Required action:

- pin approved versions/digests;
- record versions in implementation decision history;
- separate DEV image policy from TEST/PILOT policy.

**Deployment Block:** TEST/UAT/Pilot.  
**Sprint 1 Development Block:** No.

---

## C-03 — CI-Only Direct Grant Client

`qassas-cli` exists to obtain synthetic-user tokens during automated E2E testing.

Required action:

- classify as TEST-only;
- prevent creation/enabling in Pilot production realm;
- use approved interactive/federated enterprise authentication for real users.

**Deployment Block:** Pilot.  
**Sprint 1 Development Block:** No.

---

## C-04 — PR Governance

PR #2 remains Draft.

Required action before declaring Sprint 0 baseline merged:

- code review;
- condition review;
- merge approval;
- protected-branch checks.

**Deployment Block:** baseline release.  
**Sprint 1 Development Block:** No, if Sprint 1 branches from the accepted foundation branch.

---

# 9. NON-BLOCKING DEFERRED ITEMS

Not required to prove Sprint 0 foundation:

- AI service integration;
- OpenSearch;
- full portfolio dashboard;
- full Capital Governance;
- full JV workflow;
- live GMCO connectors;
- advanced GIS visualisation;
- production object storage;
- production cloud deployment.

These remain governed by the Pilot Implementation Blueprint and later Work Packages.

---

# 10. DEFECT STATUS

No known open defect currently invalidates:

- authorization model;
- Decision state integrity;
- HumanReview SoD;
- Temporal workflow boundary;
- audit reconstruction;
- transactional outbox;
- object version enforcement.

Security dependency findings remain an open hardening condition under C-01.

---

# 11. SPRINT 0 WORK PACKAGE DISPOSITION

| Work Package | Status |
|---|---|
| WP-00A Engineering Foundation | COMPLETE |
| WP-00B Canonical Persistence | COMPLETE |
| WP-00C IAM Foundation | COMPLETE |
| WP-00D Governance Transaction | COMPLETE |
| WP-00E Workflow Foundation | COMPLETE |
| WP-00F Event Foundation | COMPLETE |
| WP-00G Abu Salal Vertical Slice | COMPLETE — E2E PASS |
| WP-00H Sprint 0 Acceptance | COMPLETE — READY_WITH_CONDITIONS |

---

# 12. NEXT DELIVERY PHASE

The next phase is:

# SPRINT 1 — GOVERNED PILOT CORE

Recommended first Sprint 1 execution sequence:

1. harden dependency/runtime baseline;
2. formalise EvidenceObject + EvidenceSnapshot operations;
3. add Evidence Qualification / Data Gap / Evidence Conflict;
4. implement Decision evidence binding;
5. implement Recommendation / Next-Best-Test records;
6. extend Rights/JV constraints;
7. begin Portfolio Control read model;
8. retain Abu Salal as regression golden path.

Sprint 1 must preserve all Sprint 0 governance controls as regression gates.

---

# 13. FINAL SPRINT 0 DECISION

## READY_WITH_CONDITIONS

**Architecture proof:** PASS  
**Foundation CI:** PASS  
**Live E2E:** PASS  
**Security hardening:** OPEN CONDITIONS  
**Pilot deployment authorisation:** NOT GRANTED  
**Sprint 1 development:** AUTHORISED SUBJECT TO PRESERVING SPRINT 0 CONTROLS

---

# END — SPRINT0_FOUNDATION_DECISION — REV 0.1
