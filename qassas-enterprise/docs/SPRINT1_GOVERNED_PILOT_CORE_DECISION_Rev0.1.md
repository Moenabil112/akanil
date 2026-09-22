# QASSAS ENTERPRISE
## SPRINT1_GOVERNED_PILOT_CORE_DECISION
### Revision 0.1

**Programme:** QASSAS Enterprise — Enterprise Exploration Portfolio Operating System  
**Pilot:** QASSAS × GMCO Enterprise Exploration Portfolio Pilot  
**Branch:** `qassas/sprint-1-governed-pilot-core`  
**Draft PR:** #12 — QASSAS Sprint 1 — Governed Pilot Core  
**Acceptance Run:** QASSAS Sprint 1 Governed Core CI — Run #276  
**Run ID:** `35681392107`  
**Decision Date:** 2026-09-22

---

# 1. FORMAL DECISION

# READY_WITH_CONDITIONS

Sprint 1 Governed Pilot Core has passed its integrated engineering proof.

The core now governs the chain:

**Evidence → Decision → Recommendation / Next-Best-Test → Rights / JV Constraints → Capital → Portfolio Control**

without allowing any derived score, recommendation, technical priority, or approved capital ceiling to bypass human authority, rights constraints, or release controls.

This acceptance authorises progression to Sprint 2 development.

It does **not** authorise TEST/UAT/Pilot deployment while the Sprint 0 hardening conditions tracked in SEC-00A #11 remain unresolved or undispositioned.

---

# 2. ACCEPTED GOVERNED CORE

Sprint 1 now includes:

- EvidenceObject governance;
- append-only Evidence Qualification history;
- immutable EvidenceSnapshot;
- explicit DataGap;
- explicit EvidenceConflict;
- Decision Evidence Binding;
- CandidateAction;
- NextBestTest;
- Recommendation versioning;
- RecommendationDelta;
- independent RecommendationReview;
- Licence / Rights registry;
- Legal Holder / Operator / Economic Interest separation;
- JV constraints and partner consent;
- work commitment risk;
- Decision Constraint Assessment;
- Decision Capital;
- Execution Capital;
- capital gate assessment;
- delegated capital authority threshold;
- explicit CapitalApproval;
- explicit CapitalRelease;
- CapitalReturnedToPortfolio;
- read-only Portfolio Control projection.

---

# 3. ACCEPTANCE RUN

GitHub Actions Run #276:

| Gate | Result |
|---|---|
| Install | PASS |
| Typecheck | PASS |
| Build | PASS |
| OPA Policy Tests | PASS |
| E2E-BF01-001 | PASS |
| E2E-S1-EVIDENCE-001 | PASS |
| E2E-S1-RECOMMENDATION-001 | PASS |
| E2E-S1-CAPITAL-001 | PASS |
| E2E-S1-CONTROL-001 | PASS |

Foundation Job ID:

`106598901948`

Integrated E2E Job ID:

`106599016708`

---

# 4. EVIDENCE GOVERNANCE — ACCEPTED

Proven controls:

- scoped evidence registration;
- qualification does not overwrite prior qualification history;
- stale evidence version is rejected;
- unqualified evidence cannot enter locked snapshot;
- locked snapshots remain unchanged after later evidence qualification;
- contradictory evidence remains explicit;
- CF-4/CF-5 conflicts block decision readiness;
- blocking data gaps remain explicit;
- Decision state is derived from governed evidence controls;
- System Admin and unrelated Partner cannot infer controlled evidence.

Example acceptance reference:

Blocked Decision:

`DEC-318e385b-6851-478b-9ee2-7d334b21cd52`

---

# 5. RECOMMENDATION / NEXT-BEST-TEST — ACCEPTED

Proven controls:

- CandidateAction is explicit;
- NextBestTest is explicit and auditable;
- recommendation references a locked evidence snapshot;
- recommendation is versioned;
- supersession requires RecommendationDelta;
- recommendation author cannot silently replace prior recommendation;
- independent Human Review is required;
- accepted Recommendation does not equal Decision approval;
- AI/system recommendation path remains non-authorising by design.

---

# 6. RIGHTS / JV / COMMITMENT GOVERNANCE — ACCEPTED AS INTEGRATED CONTROL

The rights layer is now integrated into the governed decision chain.

It maintains separation of:

**Legal Holder ≠ Operator ≠ Beneficial Interest ≠ Economic Interest ≠ Funding Party ≠ JV Partner ≠ Data Rights Holder**

Constraint assessment evaluates:

- licence validation;
- licence status;
- expiry exposure;
- JV reserved matters;
- partner consent;
- work commitments;
- evidence blockers;
- technical Decision state.

A technically valid decision may therefore remain:

`PARTNER_APPROVAL_REQUIRED`

or otherwise blocked from execution.

---

# 7. CAPITAL GOVERNANCE — ACCEPTED

QASSAS now separates:

**Decision Capital** from **Execution Capital**.

The following rule is proven:

# APPROVAL ≠ RELEASE

Capital flow:

**Capital Request  
→ Gate Assessment  
→ Human Approval  
→ Gate Revalidation  
→ Explicit Release**

Required gates include:

- Evidence;
- Technical;
- Rights;
- JV;
- Recommendation where applicable;
- Delegated Authority;
- Programme Readiness.

Capital authority is enforced using effective QASSAS RoleAssignment and `capital_threshold`.

Accepted E2E references:

Released Decision Capital Request:

`CAP-621a0d8e-948f-4c80-8d97-108e3e68a059`

Threshold-Blocked Request:

`CAP-4610ba35-4ccd-4448-87f0-e16d6b87235e`

JV/Rights-Blocked Execution Request:

`CAP-84d345ac-093a-4eed-bd9f-fa3bb5c1be07`

The accepted E2E released:

**SAR 450,000**

only after explicit Finance approval and release.

---

# 8. PORTFOLIO CONTROL READ MODEL — ACCEPTED

QASSAS now exposes a derived, read-only control projection combining:

- Decision state;
- gate;
- Evidence blockers;
- latest Recommendation and review;
- Rights/JV status;
- work commitment risk;
- Capital request state;
- capital gate status;
- historical released capital;
- portfolio attention state.

This read model is **not** a source of truth.

It cannot directly mutate:

- Evidence;
- Decision;
- Rights;
- Recommendation;
- Capital.

Accepted Control E2E reference:

Funded Decision:

`DEC-CAP-35681392107`

Released Capital Total:

**SAR 450,000**

The same control view also surfaced that Decision as blocked when a later JV/Rights constraint became active, while preserving historical released-capital visibility.

This proves that:

**Latest Blocker ≠ Erasure of Historical Capital**

and:

**Historical Funding ≠ Current Execution Permission**

---

# 9. PORTFOLIO ATTENTION STATES

The accepted projection supports:

- BLOCKED;
- ACTIONABLE;
- CAPITAL_APPROVED_NOT_RELEASED;
- EXECUTION_FUNDED;
- MONITOR.

These are derived operational views.

They do not replace Decision lifecycle states.

---

# 10. ACCESS CONTROL PROOF

Sprint 1 preserves the Sprint 0 security model:

- Keycloak = identity;
- QASSAS RoleAssignment = business authority;
- OPA = contextual authorization;
- default deny;
- object scope enforcement;
- System Admin ≠ business authority;
- JV Partner cannot infer unrelated assets;
- Finance authority is scoped and thresholded.

Portfolio Control E2E proved concealment for:

- System Admin;
- unrelated Partner.

---

# 11. SPRINT 1 ACCEPTED PRODUCT LOOP

The implemented loop is now:

**External / Field Evidence  
→ Evidence Registry  
→ Evidence Qualification  
→ Evidence Snapshot  
→ Data Gap / Evidence Conflict  
→ Decision Object  
→ Candidate Actions  
→ Next-Best-Test  
→ Recommendation  
→ Human Recommendation Review  
→ Rights / JV / Commitment Assessment  
→ Capital Request  
→ Capital Gate Assessment  
→ Human Capital Approval  
→ Explicit Capital Release  
→ Outcome / New Evidence  
→ Portfolio Reassessment  
→ Portfolio Control Read Model**

This is the first complete Governed Pilot Core.

---

# 12. SPRINT 1 NON-GOALS

Sprint 1 does not claim:

- autonomous exploration;
- automated drilling approval;
- automatic resource declaration;
- automatic capital release;
- full ERP accounting;
- full GIS or 3D geological modelling;
- mine planning;
- public technical disclosure automation;
- production cloud readiness;
- live GMCO source-system integration.

---

# 13. OPEN CONDITIONS

The following conditions remain inherited from Sprint 0 SEC-00A #11:

1. dependency security findings must be triaged and dispositioned;
2. runtime container images must be pinned for TEST/UAT/Pilot;
3. `qassas-cli` direct grant must remain CI/Test-only;
4. PR governance/review must be completed before release baseline merge.

These conditions do not invalidate the Sprint 1 architecture proof.

They continue to block TEST/UAT/Pilot deployment.

---

# 14. SPRINT 1 FORMAL STATUS

## Architecture / Domain Integration: PASS

## Foundation Regression: PASS

## Evidence Governance: PASS

## Recommendation / NBT Governance: PASS

## Rights / JV Constraint Integration: PASS

## Capital Governance: PASS

## Portfolio Control Projection: PASS

## TEST/UAT/Pilot Deployment: NOT YET AUTHORISED

## Sprint 2 Development: AUTHORISED

---

# 15. NEXT PHASE

The next phase should be:

# SPRINT 2 — MULTI-ASSET PILOT EXPANSION & OPERATIONAL INTERFACES

Recommended scope:

- promote the governed core from one primary engineering asset path to the five GMCO Pilot Decision Objects;
- configure stage-specific workflow templates;
- add Al Hajar North JV multi-target workflow;
- add Umm Hijlan MRE Readiness workflow;
- add Al Godeyer Resource-Growth Value-of-Information workflow;
- add Jadib Covered-Target Method Selection workflow;
- extend Portfolio Control to multi-asset Decision Queue;
- add role-specific operational interfaces for Exploration Director, Finance and JV review;
- begin controlled external-system reference adapters without replacing source systems;
- preserve all Sprint 0/Sprint 1 E2E tests as regression gates.

---

# 16. FINAL DECISION

# READY_WITH_CONDITIONS

Sprint 1 Governed Pilot Core is accepted.

The system has moved from an engineering foundation to a governed exploration-portfolio decision core.

The next engineering objective is no longer to prove one controlled Decision.

It is to prove that the same governance model operates correctly across multiple assets, lifecycle stages, JV structures and capital decisions.

---

# END — SPRINT1_GOVERNED_PILOT_CORE_DECISION — REV 0.1
