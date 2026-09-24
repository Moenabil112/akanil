# QASSAS Enterprise — O3 Corrected Institutionalisation Path — Rev 0.1

## Decision

The previous next-step definition, **O3 — UAT Security, Central Observability & Release Promotion Controls**, is revised.

QASSAS is no longer being prepared as a single-pilot application. The operating target is now a multi-tenant institutional platform with four initial real organisations:

1. Atlas Golden Mining — Saudi Arabia
2. Abdulrahman Saad Al-Rashed & Sons Co. (ARTAR)
3. Ajlan & Bros Mining & Metals
4. Saudi Gold Refinery Company (SGR)

Therefore UAT hardening must follow institutional tenancy, portfolio separation, data-source contracts and the dedicated institutional workbench.

## Corrected promotion path

`TEST_READY`
→ **O3A Institutional Tenancy & Portfolio Onboarding**
→ **O3B Public/Private Data Pipeline Contracts**
→ **O3C Institutional Portfolio Workbench**
→ **O3D Real IAM Membership & Term-Sheet Activation**
→ **O3E UAT Security, Central Observability & Release Controls**
→ `UAT_READY`
→ Controlled partner UAT
→ `PILOT_READY`

## O3A — Institutional Tenancy

Implemented baseline:

- institution is a tenant boundary, not a human user;
- each institution owns one initial institutional portfolio;
- each institution receives one controlled institutional account record;
- institutional accounts are provisioned but cannot log in until a real IdP subject is bound;
- human members are represented separately through `institution_membership`;
- platform `SYSTEM_ADMIN` may view all tenants;
- institution members will only resolve their own enterprise boundary.

This avoids fake Keycloak users and prevents cross-tenant leakage.

## O3B — Data Pipeline Contracts

Three canonical source classes are established.

### Saudi National Geological Database — SGS NGD

Class: `PUBLIC_SOVEREIGN`

Expected domains:

- geology;
- mineral occurrences;
- geochemistry;
- geophysics;
- boreholes;
- surface samples;
- remote sensing;
- maps.

The connector contract is intentionally `PORTAL_OR_EXPORT_ADAPTER`; QASSAS must not assume an undocumented API.

### Taadeen Platform

Class: `PUBLIC_REGULATORY`

Expected domains:

- investors;
- licences;
- licence status;
- licence type;
- area;
- region;
- mineral class;
- published licence coordinates.

### Institution Partner Data Room

Class: `PRIVATE_CONTRACTUAL`

Access status at onboarding:

`TERM_SHEET_REQUIRED`

Expected domains include work programmes, assays, drilling, private geophysics/geochemistry, capital, JV rights, commercial terms and internal decisions.

No private domain may be populated from inference or public approximation.

## Data governance rule

Every ingested Evidence Object must retain:

- source system;
- source object identifier;
- retrieval timestamp;
- validation state;
- security class;
- decision fitness;
- provenance reference.

Public data can create and refresh evidence. It cannot by itself bypass QASSAS human-review, rights, JV, capital or Decision Gate controls.

## O3C — Frontend principle

The QASSAS frontend must not be a fixed dashboard designed around one portfolio size.

The shell is selected from the portfolio scale class:

- `FOCUSED`: asset-centric map + decision lane;
- `PORTFOLIO`: portfolio control board + filters + map;
- `LARGE_PORTFOLIO`: heatmap + map + priority queue + hierarchical filters;
- `ENTERPRISE`: multi-portfolio roll-up with virtualized asset grid;
- `ADAPTIVE_UNKNOWN`: data coverage and asset-discovery onboarding view.

The backend already returns a `ui_profile` with every portfolio response so the UI can adapt without tenant-specific branching.

## Initial portfolio scale baseline

- Atlas Golden Mining: `ADAPTIVE_UNKNOWN` until its Saudi asset inventory is ingested/contractually supplied.
- ARTAR: `PORTFOLIO`, seeded with 8 publicly reported active licences.
- Ajlan & Bros Mining & Metals: `LARGE_PORTFOLIO`, seeded with 38 publicly reported licences at group/mining-portfolio level.
- Saudi Gold Refinery: `ADAPTIVE_UNKNOWN` until the portfolio count is locked from public ingestion or partner data.

Asset counts are provenance-bearing observations, not immutable master data.

## O3D — Real identity activation

The four institutional accounts currently remain:

`PROVISIONED / PENDING_IDP_LINK`

This is intentional.

Activation requires:

1. named authorised institutional administrator;
2. verified email/domain or enterprise IdP identity;
3. Term Sheet / access basis where private data is requested;
4. explicit institution membership;
5. role and security-clearance assignment;
6. Keycloak subject binding;
7. audit event for activation.

Only then does `login_enabled` become true.

## O3E — UAT hardening

After O3A–O3D are structurally stable:

- TLS everywhere;
- hardened Keycloak deployment;
- Temporal TLS/authorization;
- managed secrets;
- centralized logs, metrics and traces;
- immutable image digests;
- backup/RTO/RPO validation;
- tenant-isolation penetration tests;
- release promotion approvals;
- UAT evidence bundle.

## Architecture Lock

No O3 change grants automated decision authority.

Scoring and recommendation remain `ADVISORY_ONLY`.

Human review, mineral rights, JV consent, capital controls and Decision Gates remain authoritative.
