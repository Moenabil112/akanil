# QASSAS ENTERPRISE
## SPRINT3_PORTFOLIO_INTELLIGENCE_DECISION
### Revision 0.1

**Programme:** QASSAS Enterprise — Enterprise Exploration Portfolio Operating System  
**Pilot:** QASSAS × GMCO Enterprise Exploration Portfolio Pilot  
**Sprint:** Sprint 3 — Portfolio Intelligence, Prioritisation & Control Board  
**Branch:** `qassas/sprint-3-portfolio-intelligence-control-board`  
**Draft PR:** #75  
**Acceptance Run:** QASSAS Sprint 3 Portfolio Intelligence CI — Run #421  
**Run ID:** `35897649468`  
**Accepted Functional Head:** `e8acd1290cf82d853f812cfb24fe6157de91fc1a`  
**Decision Date:** 2026-09-23

---

# 1. FORMAL DECISION

# READY_WITH_CONDITIONS

Sprint 3 has passed its portfolio-intelligence, prioritisation and executive-control acceptance gates.

QASSAS can now rank the five GMCO Pilot assets using a transparent Portfolio Priority Index and an independent Value-of-Information-per-SAR signal, while preserving Evidence, Rights/JV, Human Review and Capital controls above every score.

This decision authorises progression to Sprint 4 development.

It does not authorise TEST/UAT/Pilot production deployment until inherited security/runtime hardening conditions are dispositioned.

---

# 2. SPRINT 3 CAPABILITIES ACCEPTED

## Portfolio Priority Assessment — PPI-0.1

Versioned assessment dimensions:
- Geological Potential
- Evidence Confidence
- Technical Maturity
- Scale Potential
- Strategic Adjacency
- Cost Efficiency
- Data Quality
- Work Commitment Risk
- Partner Constraint

The derived Portfolio Priority Index is explainable and advisory.

## Value of Information per SAR

QASSAS maintains a separate information-leverage signal:

`expected information gain / next-decision cost`

PPI and VoI are deliberately distinct.

## Portfolio Priority Queue

Provides:
- five authorised Pilot assets;
- PPI position;
- VoI position;
- Decision state;
- evidence blockers;
- Rights/JV state;
- work-commitment risk;
- capital state;
- advisory action class.

Authorization filtering occurs before ranking.

## Portfolio Control Board

Executive read model provides:
- governed priority queue;
- information-leverage view;
- blocker counts;
- partner-approval counts;
- requested/released capital totals;
- advisory action distribution;
- change intelligence.

The Control Board is not a source of canonical approval state.

## RecommendationDelta / Change Intelligence

Material Recommendation changes are surfaced without mutating:
- Decision approval;
- Gate;
- JV consent;
- Capital authority.

## Portfolio Reassessment Snapshot

Immutable, idempotent portfolio snapshots capture:
- current Control Board state;
- change feed;
- source-event references;
- model version;
- portfolio-state hash.

Snapshots cannot authorise execution, release capital or change a Gate.

## Portfolio Action Classification — PAC-0.1

Advisory classes include:
- ACCELERATE
- FUND
- JV_GOVERNED
- PARTNER_CAPITAL
- TARGET_GENERATION
- SELECTIVE_VALIDATION
- HOLD_DROP_FARM_OUT

Classification is advisory only.

---

# 3. SCORE-TO-AUTHORITY SEPARATION

Sprint 3 acceptance proves:

- score cannot approve a Decision;
- score cannot change a Gate;
- score cannot satisfy JV consent;
- score cannot release Capital;
- score cannot authorise execution;
- repeated ranking reads do not mutate governed state.

This preserves the controlling rule:

> Portfolio Priority → Decision Object → Evidence / Constraints → Human Review → Capital Governance → Execution Authorisation.

---

# 4. JV FAIL-CLOSED CONTROL

Al Hajar North remains JV controlled.

If a current constraint assessment is unavailable, the Portfolio layer uses the governed Pilot configuration to fail closed:

- `partner_approval_required = true`
- `partner_consent_status = UNKNOWN`

This fallback does not invent partner consent.

It prevents a portfolio score from bypassing an unresolved JV control state.

---

# 5. FIVE-ASSET PORTFOLIO ACCEPTANCE

| DO | Asset | Portfolio Context |
|---|---|---|
| DO-001 | Umm Hijlan / Mamilah | MRE Readiness |
| DO-002 | Abu Salal | Discovery to Resource |
| DO-003 | Al Hajar North | Multi-Target + JV |
| DO-004 | Al Godeyer | Incremental Resource Value |
| DO-005 | Jadib Al Qahtanah | Covered Target Test |

Acceptance proves:
- all five assets can be compared in one authorised portfolio view;
- each retains its own lifecycle stage and decision class;
- Jadib may lead VoI without becoming Drill Ready;
- a high-scoring JV asset remains governance-blocked;
- PPI ranking and VoI ranking may differ.

---

# 6. SECURITY / ANTI-INFERENCE ACCEPTANCE

Acceptance proves:
- Portfolio Executive can access the full authorised Pilot portfolio;
- Exploration Director can access the authorised priority queue;
- Exploration Director does not inherit executive Control Board authority;
- Partner User cannot infer the enterprise portfolio;
- System Admin does not inherit business portfolio visibility;
- ranking occurs only after object-level authorization filtering.

---

# 7. CURRENT FUNCTIONAL-HEAD CI ACCEPTANCE

QASSAS Sprint 3 Portfolio Intelligence CI — Run #421:

## Foundation
- Install — PASS
- Typecheck — PASS
- Build — PASS
- OPA policy tests — PASS

## Regression / E2E
- E2E-BF01-001 — PASS
- E2E-S1-EVIDENCE-001 — PASS
- E2E-S1-RECOMMENDATION-001 — PASS
- E2E-S1-RIGHTS-001 — PASS
- E2E-S1-CAPITAL-001 — PASS
- E2E-S1-CONTROL-001 — PASS
- E2E-S2-MULTI-ASSET-001 — PASS
- E2E-S3-PORTFOLIO-001 — PASS

Sprint 3 E2E explicitly proves:
- five-asset priority queue;
- PPI and VoI separation;
- advisory action classification;
- JV blocker dominance;
- anti-inference;
- non-mutating score reads;
- versioned Priority Assessment;
- RecommendationDelta change intelligence;
- immutable/idempotent Portfolio Reassessment Snapshot.

---

# 8. DEFECTS RESOLVED DURING ACCEPTANCE

## S3-FIX-01 — Duplicate E2E Reassessment Block
Removed duplicate Jadib reassessment code that caused duplicate variable declaration and invalid test sequencing.

## S3-FIX-02 — Missing JV Constraint Fallback
Added fail-closed fallback from governed Pilot configuration when a current constraint projection is absent.

## S3-FIX-03 — Reassessment Snapshot JSONB Serialization
Explicitly serialised `source_event_refs` and snapshot payloads as JSON for PostgreSQL JSONB persistence.

All three fixes are covered by the successful Run #421.

---

# 9. WORK PACKAGE DISPOSITION

| Work Package | Status |
|---|---|
| Portfolio Priority Model / PPI | COMPLETE |
| Value-of-Information per SAR | COMPLETE |
| Portfolio Priority Queue | COMPLETE |
| Executive Control Board | COMPLETE |
| Change Intelligence | COMPLETE |
| Reassessment Snapshot | COMPLETE |
| Advisory Action Classification | COMPLETE |
| WP-03G Sprint 3 Portfolio E2E | COMPLETE — PASS |
| WP-03H Sprint 3 Acceptance | COMPLETE — READY_WITH_CONDITIONS |

---

# 10. INHERITED CONDITIONS

Sprint 3 does not clear deployment-hardening conditions tracked under:

**SEC-00A — Issue #11**

Including:
- dependency-security disposition;
- runtime image/version pinning;
- TEST-only direct-grant CI identity handling.

These conditions block TEST/UAT/Pilot deployment where applicable but do not invalidate the Sprint 3 functional or architecture proof.

---

# 11. SPRINT 3 LOCK CANDIDATES

## S3L-01
Portfolio scores are advisory and never authority-bearing.

## S3L-02
Authorization filtering occurs before portfolio ranking.

## S3L-03
PPI and Value-of-Information remain separate signals.

## S3L-04
Rights/JV, Evidence and Capital blockers dominate advisory ranking.

## S3L-05
Unknown material JV control state fails closed.

## S3L-06
Portfolio Priority Assessment is versioned; history remains immutable.

## S3L-07
Portfolio Reassessment Snapshots are immutable and idempotent.

## S3L-08
RecommendationDelta may trigger reassessment but not approval.

## S3L-09
Portfolio Action Classification is advisory only.

## S3L-10
Control Board projections do not become sources of canonical truth.

---

# 12. NEXT PHASE

# SPRINT 4 — GMCO PILOT INTEGRATION, UAT & RELEASE CANDIDATE

Primary objectives:

1. replace synthetic/public-reference baselines with controlled GMCO Pilot data packs where authorised;
2. reconcile five live Decision Objects;
3. validate source authority and data freshness;
4. complete client-role UAT;
5. execute TD-06 acceptance matrix;
6. complete security/runtime hardening required for Pilot;
7. generate Pilot audit evidence pack;
8. issue GMCO Pilot Go / Conditional-Go / No-Go;
9. produce QASSAS Enterprise — GMCO Pilot Release Candidate 1.0.

---

# 13. FINAL SPRINT 3 DECISION

## READY_WITH_CONDITIONS

**Portfolio Priority Model:** PASS  
**VoI per SAR:** PASS  
**Portfolio Queue:** PASS  
**Control Board:** PASS  
**Change Intelligence:** PASS  
**Reassessment Snapshot:** PASS  
**JV fail-closed governance:** PASS  
**Anti-inference:** PASS  
**Sprint 0–2 regressions:** PASS  
**Sprint 3 E2E:** PASS  
**Deployment hardening:** OPEN CONDITIONS  
**Sprint 4 development:** AUTHORISED

---

# END — SPRINT3_PORTFOLIO_INTELLIGENCE_DECISION — REV 0.1
