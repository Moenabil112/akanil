# QASSAS ENTERPRISE
## SPRINT2_MULTI_ASSET_PILOT_DECISION
### Revision 0.1

**Programme:** QASSAS Enterprise — Enterprise Exploration Portfolio Operating System  
**Pilot:** QASSAS × GMCO Enterprise Exploration Portfolio Pilot  
**Sprint:** Sprint 2 — Multi-Asset Pilot Expansion & Operational Interfaces  
**Branch:** `qassas/sprint-2-multi-asset-pilot`  
**Draft PR:** #41  
**Acceptance Run:** QASSAS Sprint 2 Multi-Asset Pilot CI — Run #327  
**Run ID:** `35747057351`  
**Accepted Code Head:** `870d7a015ae2659ceab5755fc2f7e6539c74047a`  
**Decision Date:** 2026-09-22

---

# 1. FORMAL DECISION

# READY_WITH_CONDITIONS

Sprint 2 has passed its governed multi-asset expansion and operational-interface acceptance gates.

The five GMCO Pilot decision environments are now represented in one governed QASSAS portfolio operating context without collapsing their different exploration stages, evidence requirements, JV constraints, or reviewer authorities.

This decision authorises progression to Sprint 3 development.

It does not authorise TEST/UAT/Pilot production deployment until inherited security/runtime hardening conditions are dispositioned.

---

# 2. ACCEPTED PILOT ASSET CONFIGURATION

| Decision Object | Pilot Asset | Decision Class | Gate | Workflow Template |
|---|---|---|---|---|
| DO-001 | Umm Hijlan / Mamilah | MRE_READINESS | G7_RESOURCE_DEFINITION | WT-MRE-READINESS |
| DO-002 | Abu Salal | DISCOVERY_REVIEW | G6_DISCOVERY | WT-DISCOVERY-TO-RESOURCE |
| DO-003 | Al Hajar North | MULTI_TARGET_PORTFOLIO | G2_TARGET_GENERATED | WT-MULTI-TARGET-JV |
| DO-004 | Al Godeyer | INCREMENTAL_RESOURCE_VALUE | G8_RESOURCE_GROWTH | WT-RESOURCE-GROWTH-VOI |
| DO-005 | Jadib Al Qahtanah | COVERED_TARGET_TEST | G2_TARGET_GENERATED | WT-COVERED-TARGET-TEST |

Umm Hijlan VMS and Mamilah Gold remain separate Target/Prospect identities inside the same Pilot asset context.

---

# 3. SPRINT 2 CAPABILITIES ACCEPTED

## Multi-Asset Configuration
- workflow template registry;
- Pilot asset profile registry;
- canonical mapping of DO-001 through DO-005;
- configured gate and decision class enforcement;
- active/inactive template control.

## Multi-Asset Decision Queue
- five-asset queue over governed Decision state;
- NOT_STARTED and live Decision states;
- evidence blockers;
- Recommendation review state;
- Rights/JV state;
- Work Commitment risk;
- Capital state;
- Portfolio attention state;
- last governed activity.

The queue is a read model and does not mutate source domains.

## Exploration Director Interface
Provides:
- five-asset Decision Queue;
- evidence readiness;
- blocking gaps/conflicts;
- Recommendation review state;
- partner/JV constraints;
- capital state;
- next controlled action.

## Finance Interface
Provides:
- authorised asset scope;
- capital request/release state;
- Rights/JV blockers;
- historical released capital.

It intentionally excludes detailed evidence/recommendation fields not required for the finance function.

## JV Review Interface
Provides only:
- authorised JV asset;
- reserved matters;
- consent state;
- relevant mandatory work commitments.

It does not expose unrelated GMCO assets or internal capital scenarios.

---

# 4. STAGE-SPECIFIC GOVERNANCE PROVEN

## DO-001 — Umm Hijlan / Mamilah

The MRE template requires:

`RESOURCE_GEOLOGIST_CP`

for HumanReview.

Acceptance proved:
- Exploration Director can open/request the MRE-readiness Decision;
- Exploration Director cannot substitute for the required CP review;
- independent Resource Geologist / CP can approve the controlled HumanReview.

## DO-002 — Abu Salal

Sprint 0/1 golden-path regression remains green.

## DO-003 — Al Hajar North

The asset remains:
- multi-target;
- JV controlled;
- partner-scope protected.

## DO-004 — Al Godeyer

The configured stage remains:
`G8_RESOURCE_GROWTH`

with Value-of-Information oriented workflow context.

## DO-005 — Jadib Al Qahtanah

A false promotion to:
`G5_DRILL_READY`

is rejected.

The configured workflow remains:
`WT-COVERED-TARGET-TEST`

at:
`G2_TARGET_GENERATED`.

Historical high-grade context does not automatically create Drill Ready status.

---

# 5. SECURITY / ANTI-INFERENCE ACCEPTANCE

Acceptance proved:

- Exploration Director sees the five authorised Pilot assets.
- Finance sees only authorised finance-operational fields.
- Partner User sees Al Hajar North only.
- Partner workflow-template visibility is limited to the authorised JV context.
- Partner operational interface does not expose unrelated asset counts or internal capital scenarios.
- System Admin receives no business-portfolio authority by default.
- System Admin is denied Exploration, Finance and JV operational business interfaces.

---

# 6. CURRENT-HEAD CI ACCEPTANCE

Run #327 completed successfully.

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

The Sprint 2 E2E explicitly proved:
- five-asset registry;
- stage-specific workflow templates;
- governed Decision Queue;
- JV anti-inference;
- System Admin separation;
- Finance field minimisation;
- Exploration Director interface;
- JV operational minimisation;
- all five Pilot Decision Objects with live governed Decision contexts;
- Resource Geologist / CP review enforcement for MRE readiness;
- separate Mamilah Target identity;
- Jadib stage/gate enforcement.

---

# 7. WORK PACKAGE DISPOSITION

| Work Package | Status |
|---|---|
| WP-02A Multi-Asset Configuration Registry | COMPLETE |
| WP-02B Multi-Asset Decision Queue | COMPLETE |
| WP-02C Stage-Specific Workflow Templates | COMPLETE |
| WP-02D Exploration Director Interface | COMPLETE |
| WP-02E Finance Interface | COMPLETE |
| WP-02F JV Review Interface | COMPLETE |
| WP-02G Five-Asset E2E Pilot Expansion | COMPLETE — PASS |
| WP-02H Sprint 2 Acceptance | COMPLETE — READY_WITH_CONDITIONS |

---

# 8. INHERITED CONDITIONS

Sprint 2 does not clear the deployment-hardening conditions already tracked under:

**SEC-00A — QASSAS Sprint 0 Dependency & Runtime Hardening — Issue #11**

These include:
- dependency-security disposition;
- runtime container version/digest pinning;
- TEST-only restriction of the direct-grant CI identity client.

These conditions block TEST/UAT/Pilot deployment where applicable, but do not invalidate the Sprint 2 architecture and functional proof.

---

# 9. SPRINT 2 LOCK CANDIDATES

## S2L-01
The Pilot portfolio is configuration-driven; asset-specific behaviour must not be hard-coded into UI logic.

## S2L-02
The Decision Queue is a governed read model, not a source of truth.

## S2L-03
Portfolio ordering is not autonomous capital authorisation.

## S2L-04
Each Pilot asset retains its own decision class and lifecycle gate.

## S2L-05
Umm Hijlan and Mamilah may share asset/licence context while retaining separate Prospect/Target identities.

## S2L-06
Workflow templates control required reviewer role.

## S2L-07
MRE-readiness HumanReview may require Resource Geologist / Competent Person authority.

## S2L-08
Partner/JV users may not infer unrelated portfolio assets through queue counts, template lists, or operational interfaces.

## S2L-09
Finance interfaces apply field minimisation and do not confer technical approval.

## S2L-10
Operational interfaces remain projections over canonical governed objects.

---

# 10. NEXT PHASE

The recommended next phase is:

# SPRINT 3 — PORTFOLIO INTELLIGENCE, PRIORITISATION & CONTROL BOARD

Primary objectives:

1. formalise TargetAssessment across the five assets;
2. implement the approved scoring dimensions;
3. implement Portfolio Priority Index as a transparent derived score;
4. implement Value-of-Information per SAR;
5. create RecommendationDelta-driven portfolio reassessment;
6. create Decision Queue prioritisation without capital auto-authorisation;
7. build Board / Exploration / Finance portfolio control snapshots;
8. implement scenario comparison and controlled portfolio re-ranking;
9. preserve Rights/JV/Capital blockers above ranking;
10. produce a five-asset portfolio decision demonstration.

---

# 11. FINAL SPRINT 2 DECISION

## READY_WITH_CONDITIONS

**Multi-asset architecture:** PASS  
**Five-asset Decision configuration:** PASS  
**Stage-specific governance:** PASS  
**Operational interfaces:** PASS  
**JV anti-inference:** PASS  
**Sprint 0/1 regression:** PASS  
**Five-asset E2E:** PASS  
**Deployment hardening:** OPEN CONDITIONS  
**Sprint 3 development:** AUTHORISED

---

# END — SPRINT2_MULTI_ASSET_PILOT_DECISION — REV 0.1
