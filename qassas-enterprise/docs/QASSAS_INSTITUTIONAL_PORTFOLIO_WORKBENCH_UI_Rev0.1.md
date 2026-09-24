# QASSAS Institutional Portfolio Workbench — Frontend Specification — Rev 0.1

## Product surface

The Workbench is a tenant-aware application shell, not an admin CRM page.

A platform operator may switch between authorised institutions. An institutional user receives no institution switcher unless they hold memberships in more than one tenant.

## Primary navigation

- Portfolio Overview
- Map & Mineral Rights
- Geological Evidence
- Targets
- Decision Queue
- Work Programmes
- Rights / JV / Commitments
- Capital
- Data Sources
- Audit & Provenance

## Portfolio header

Always show:

- institution name;
- portfolio name;
- visible asset count;
- data freshness;
- public/private source coverage;
- Term Sheet state;
- governance-blocked decisions;
- active decision gates.

Never show another tenant's aggregate data.

## Adaptive layout

### FOCUSED

For 1–5 assets.

Dominant surface: map and asset dossier.

Secondary surface: current decision lane, evidence gaps and next-best-test.

### PORTFOLIO

For 6–20 assets.

Dominant surface: control board with region/mineral/licence/gate filters.

Map and priority queue remain simultaneously visible on desktop.

### LARGE_PORTFOLIO

For 21–60 assets.

Dominant surface: portfolio heatmap and virtualized decision queue.

Use hierarchical filters, saved views and bulk selection for read-only analysis. Bulk actions must never approve decisions or release capital.

### ENTERPRISE

For >60 assets or multiple portfolio books.

Dominant surface: roll-up KPIs, portfolio groups, regional map and virtualized asset grid.

### ADAPTIVE_UNKNOWN

Used while the asset universe is still being established.

Dominant surface: source coverage, discovered licences/assets, unmatched records and data-quality state.

## Data source UX

Each data item receives a provenance badge:

- SGS NGD — public sovereign;
- Taadeen — public regulatory;
- Partner Data Room — private contractual.

Private panels remain visibly locked when `TERM_SHEET_REQUIRED`.

A locked private panel must not be back-filled with inferred information.

## Partner-aware design

Partner relationships should be shown as a graph or matrix only where an authorised contractual relationship exists.

Recommended dimensions:

- institution;
- asset/licence;
- ownership/JV role;
- consent requirement;
- work commitment;
- security class;
- data-sharing status.

## Responsive behaviour

Desktop: 12-column analytical workspace.

Tablet: map or board becomes primary with drawer-based secondary context.

Mobile: executive portfolio summary, alerts, decision queue and asset dossier; complex GIS editing is not a mobile primary task.

## Visual density

The user can select:

- Executive;
- Standard;
- Analyst.

Default density is derived from portfolio scale, but preference is stored per user, not per institution.

## Safety and governance UX

Every advisory score must carry the label:

`ADVISORY — NOT A DECISION AUTHORITY`

Every blocked item must expose the controlling reason, for example:

- evidence gap;
- contradictory evidence;
- licence risk;
- partner consent required;
- capital gate incomplete;
- human review required.

The UI must never replace those controls with a single synthetic score.
