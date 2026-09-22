# QASSAS ENTERPRISE
## SPRINT3_PORTFOLIO_INTELLIGENCE_DECISION
### Revision 0.1

**Programme:** QASSAS Enterprise — Enterprise Exploration Portfolio Operating System  
**Pilot:** QASSAS × GMCO Enterprise Exploration Portfolio Pilot  
**Sprint:** Sprint 3 — Portfolio Intelligence, Prioritisation & Control Board  
**Branch:** `qassas/sprint-3-portfolio-intelligence`  
**Draft PR:** #66  
**Acceptance Run:** QASSAS Sprint 3 Portfolio Intelligence CI — Run #365  
**Run ID:** `35760350339`  
**Accepted Code Head:** `22edba51b6d75ca9a1bb828b7f99ed31667fe1fa`  
**Decision Date:** 2026-09-22

---

# 1. FORMAL DECISION

# READY_WITH_CONDITIONS

Sprint 3 has passed its governed Portfolio Intelligence, prioritisation and Control Board acceptance gates.

QASSAS now supports transparent portfolio comparison across the five GMCO Pilot Decision Objects while preserving Evidence, Rights/JV, Work Commitment, Capital and Human Approval controls above ranking.

This decision authorises progression to Sprint 4 development.

It does not authorise TEST/UAT/Pilot deployment until inherited security/runtime hardening conditions are dispositioned.

---

# 2. ACCEPTED PORTFOLIO INTELLIGENCE CAPABILITIES

## TargetAssessment

Implemented as immutable, versioned records with the approved dimensions:

1. Geological Potential
2. Evidence Confidence
3. Technical Maturity
4. Scale Potential
5. Strategic Adjacency
6. Cost-to-Next-Decision
7. Work Commitment Risk
8. Partner Constraint
9. Data Quality

Negative dimensions remain explicit and are inverted only inside the transparent scoring formula.

## Portfolio Priority Index

A versioned scoring model derives a transparent Portfolio Priority Index (PPI).

The Pilot model is synthetic calibration for system validation only.

It is not:
- a resource estimate;
- an asset valuation;
- an investment recommendation;
- an autonomous exploration approval.

## Value-of-Information per SAR

QASSAS calculates:

`VoI Points per SAR 1M = Expected Information Gain / Cost-to-Next-Decision × 1,000,000`

PPI and VoI are deliberately separate decision lenses.

## Governance-Dominant Prioritisation

Portfolio ranking never suppresses:

- blocking EvidenceConflict;
- blocking DataGap;
- Licence risk;
- Work Commitment risk;
- Partner/JV consent;
- Capital block;
- controlled HumanReview.

The read model explicitly records:

`score_authorises_execution = false`

---

# 3. CONTROL BOARD

The Sprint 3 Control Board now exposes, per authorised asset:

- Decision Object;
- Decision state;
- lifecycle Gate;
- latest TargetAssessment;
- all nine scoring dimensions;
- PPI;
- priority rank;
- VoI per SAR;
- Evidence control state;
- Rights/JV state;
- Work Commitment state;
- Capital state;
- next controlled action;
- last governed activity.

The Control Board is a read-only projection.

It is not a source of canonical business truth.

---

# 4. RECOMMENDATION-DELTA REASSESSMENT

Sprint 3 accepts a controlled reassessment path:

**RecommendationDelta / material change  
→ new immutable TargetAssessment  
→ prior assessment preserved  
→ previous/new PPI  
→ previous/new VoI  
→ PortfolioReassessment record  
→ human-governed portfolio context**

Acceptance proved:

- TargetAssessment history is immutable;
- RecommendationDelta can trigger reassessment;
- previous assessment remains reconstructable;
- PPI/VoI deltas are explicit;
- reassessment has no automatic Gate consequence;
- reassessment has no automatic Capital consequence;
- reassessment has no automatic execution consequence.

---

# 5. SCENARIO COMPARISON

Sprint 3 supports immutable, explicitly non-authoritative portfolio scenarios.

A scenario stores:

- scenario name/purpose;
- baseline scoring-model reference;
- nine scenario weights;
- assessment references used;
- calculated alternative PPI/rank;
- PPI delta from baseline.

Every scenario is stored with:

`authoritative = false`

Scenario outputs cannot:

- mutate canonical TargetAssessment;
- approve a Decision;
- change a lifecycle Gate;
- satisfy JV consent;
- approve or release Capital;
- authorise execution.

---

# 6. ROLE-SPECIFIC INTELLIGENCE VIEWS

## Portfolio Executive

Receives a Board-level portfolio view with:

- PPI/rank;
- VoI;
- governance state;
- Capital state;
- next controlled action.

## Exploration Director

Receives the full technical intelligence context including:

- all nine dimensions;
- TargetAssessment rationale;
- Evidence/constraint state;
- PPI/VoI;
- next controlled action.

## Finance Reviewer

Receives a minimised financial intelligence view:

- PPI/rank;
- Cost-to-Next-Decision;
- VoI;
- Rights/JV blockers;
- Work Commitment/Licence risk;
- Capital state;
- released Capital.

Finance does not receive detailed geological dimension/rationale fields through this interface.

## Partner / JV User

No Portfolio Intelligence Board access is granted in Sprint 3.

Existing Sprint 2 JV-minimised operational interfaces remain the permitted path.

## System Administrator

System Admin receives no business-intelligence authority by default.

---

# 7. FIVE-ASSET DEMONSTRATION

The five GMCO Pilot Decision Objects remain represented:

| Decision Object | Asset | Decision Context |
|---|---|---|
| DO-001 | Umm Hijlan / Mamilah | MRE Readiness |
| DO-002 | Abu Salal | Discovery to Resource |
| DO-003 | Al Hajar North | Multi-Target Portfolio + JV |
| DO-004 | Al Godeyer | Incremental Resource Value |
| DO-005 | Jadib Al Qahtanah | Covered Target Test |

Synthetic Sprint 3 calibration intentionally demonstrated different priority lenses.

In the acceptance dataset:

- Al Godeyer initially carries the highest PPI;
- Jadib carries the highest VoI per SAR.

This difference is an intentional system test, not an asset-value conclusion.

Acceptance also proved:

- Jadib high VoI does not move it from G2 to G5 Drill Ready;
- a high-PPI Al Godeyer Decision can still be blocked by governed Capital authority;
- the PPI remains visible while the governance state becomes `BLOCKED_CAPITAL`;
- score does not override the Capital state machine.

---

# 8. CURRENT-HEAD CI ACCEPTANCE

Run #365 completed successfully on accepted code head:

`22edba51b6d75ca9a1bb828b7f99ed31667fe1fa`

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

The Sprint 3 E2E explicitly proved:

- five-asset scoring;
- all nine dimensions;
- PPI;
- VoI per SAR;
- different PPI vs VoI leaders;
- high-ranking blocked asset;
- score/capital separation;
- Jadib Gate preservation;
- Portfolio Executive Board access;
- Exploration Director technical view;
- Finance field minimisation;
- Partner/System Admin denial;
- RecommendationDelta-driven reassessment;
- assessment immutability;
- idempotent reassessment creation;
- reassessment history;
- non-authoritative scenario comparison.

---

# 9. WORK PACKAGE DISPOSITION

| Work Package | Status |
|---|---|
| WP-03A TargetAssessment & Scoring Model | COMPLETE |
| WP-03B Portfolio Priority Index & VoI/SAR | COMPLETE |
| WP-03C RecommendationDelta Reassessment | COMPLETE |
| WP-03D Control Board Read Model | COMPLETE |
| WP-03E Scenario Comparison | COMPLETE |
| WP-03F Board / Exploration / Finance Views | COMPLETE |
| WP-03G Five-Asset Portfolio Decision Demo | COMPLETE — PASS |
| WP-03H Sprint 3 Acceptance | COMPLETE — READY_WITH_CONDITIONS |

---

# 10. SPRINT 3 LOCK CANDIDATES

## S3L-01
TargetAssessment history is immutable and versioned.

## S3L-02
PPI is a transparent derived score, not an approval authority.

## S3L-03
Value-of-Information per SAR remains independent from PPI.

## S3L-04
Negative dimensions are retained explicitly and inverted only in scoring logic.

## S3L-05
Governance blockers remain independent from ranking.

## S3L-06
No score may approve Capital, Gate transition, JV consent or execution.

## S3L-07
RecommendationDelta may trigger reassessment but never automatic execution.

## S3L-08
Scenario comparisons are immutable and non-authoritative.

## S3L-09
Operational intelligence views enforce role-specific field minimisation.

## S3L-10
Portfolio Intelligence remains a read/decision-support layer over canonical governed objects.

---

# 11. INHERITED CONDITIONS

Sprint 3 does not clear deployment-hardening conditions tracked under:

**SEC-00A — QASSAS Sprint 0 Dependency & Runtime Hardening — Issue #11**

These include:

- dependency-security disposition;
- runtime container version/digest pinning;
- TEST-only restriction of the direct-grant CI identity client.

These conditions block TEST/UAT/Pilot deployment where applicable.

They do not invalidate the Sprint 3 architecture and functional proof.

---

# 12. NEXT PHASE

Recommended next phase:

# SPRINT 4 — GMCO PILOT INTEGRATION, UAT & RELEASE CANDIDATE

Primary objectives:

1. map authorised GMCO source packs to canonical entities;
2. replace synthetic assessment calibration with controlled Pilot inputs where available;
3. onboard the five Pilot Decision Objects using authorised data;
4. reconcile public/source references with client-controlled evidence;
5. execute role-based UAT;
6. run security/anti-inference acceptance;
7. complete deployment hardening conditions;
8. create Pilot Acceptance Evidence Register;
9. execute final Go / Conditional-Go / No-Go;
10. produce QASSAS Enterprise — GMCO Pilot Release Candidate.

---

# 13. FINAL SPRINT 3 DECISION

## READY_WITH_CONDITIONS

**TargetAssessment:** PASS  
**Transparent PPI:** PASS  
**VoI/SAR:** PASS  
**Governance-dominant ranking:** PASS  
**Reassessment:** PASS  
**Scenario comparison:** PASS  
**Control Board:** PASS  
**Role-specific views:** PASS  
**Five-asset E2E:** PASS  
**Sprint 0–2 regression:** PASS  
**Deployment hardening:** OPEN CONDITIONS  
**Sprint 4 development:** AUTHORISED

---

# END — SPRINT3_PORTFOLIO_INTELLIGENCE_DECISION — REV 0.1
