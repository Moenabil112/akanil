# QASSAS Repository Governance Closure — RGC-01 — Rev 0.1

**Status:** ACTIVE — CLOSURE IN PROGRESS  
**Date:** 2026-09-25  
**Repository:** `Moenabil112/akanil`

## 1. Purpose

RGC-01 closes repository-governance debt accumulated while QASSAS moved from Sprint 0 through O3 M3.

This document does not change QASSAS business authority, decision authority, capital authority, rights authority, or human-review requirements.

## 2. Canonical technical baseline

Current accepted QASSAS baseline before RGC-01:

- branch: `qassas/o3-institutional-portfolios-data-pipeline`
- commit: `fe2483812aa4509432dc96ce8c8f9ec2ffea7356`
- maturity: TEST_READY + O3 Institutionalisation through M3
- M1: merged
- M2: merged
- M3: merged
- M4: not started

The release branch created by this closure must originate from the final RGC-01 commit.

## 3. Required CI gates

A release or governance branch must execute:

1. QASSAS Sprint 3 Portfolio Intelligence CI;
2. QASSAS Operational Readiness Gate;
3. QASSAS O2 TEST Deployment & Observability;
4. QASSAS O3 Institutional Portfolio Model.

Release branches use the pattern:

`qassas/release-**`

## 4. Historical PR disposition

Historical implementation PRs from Sprint 0 through O3 are preserved as immutable review history but may be closed as superseded when their commits are ancestors of the accepted canonical baseline.

Merged micro-sprints remain closed/merged:
- PR #95 — M1 Institutional Admin Activation;
- PR #96 — M2 Term Sheet & Partner Data;
- PR #97 — M3 Taadeen Live Adapter.

Superseded stacked PRs are not release authorities after RGC-01.

## 5. SEC-00A disposition

SEC-00A acceptance evidence is satisfied by the current locked baseline:

- `package-lock.json` exists and CI uses `npm ci`;
- latest Operational Readiness run reports `found 0 vulnerabilities` for runtime audit;
- Critical findings: 0;
- current High findings: 0 in the locked dependency evidence;
- OPA image is pinned;
- supported Temporal TEST Server/Admin Tools images are pinned;
- Pilot and Production IAM profiles explicitly reject `qassas-cli`, direct access grants, and synthetic/imported users;
- protected IAM validation passes in CI.

Historical High findings are treated as resolved because they are not reproduced by the current locked dependency graph.

## 6. GitHub administrative controls

The following repository settings are required but are outside the write surface available to the current automation:

- set a canonical default branch appropriate for the whole Akanil repository;
- protect the canonical QASSAS release/integration branch;
- require successful status checks for the four QASSAS gates;
- block force-pushes and branch deletion on the protected release branch;
- require pull-request review before release-branch changes.

Until those settings are applied, release governance is enforced by branch convention, CI and this closure record, but is not server-enforced by GitHub branch protection.

## 7. Release baseline naming

The first governed release baseline after M3 is:

`qassas/release-o3-m3-test-ready`

This is a TEST_READY engineering baseline. It is not UAT_READY, PILOT_READY, or Production Ready.

## 8. Next phase

After RGC-01 PASS:

`M4 — Saudi National Geological Database / NGD Live Adapter`

must branch from the accepted governed baseline rather than from an obsolete stacked PR branch.
