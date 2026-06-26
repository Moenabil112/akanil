# Akanil Platform

**From Earth to Trust. From Mineral Data to Institutional Decision.**

Akanil is an institutional digital ecosystem for strategic minerals, mining
intelligence, AI infrastructure, trust governance, controlled data room access,
and sustainability. This repository contains the platform web application — a
premium, dark, institutional Next.js site implementing the public digital
windows and the public-to-private access request flow.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with the Akanil institutional design system
- **Inter** + **Space Grotesk** typography (via `next/font`)
- API route intake for access requests (Resend-ready, Supabase-ready)

The recommended production integrations — **Sanity CMS**, **Supabase**,
**Resend/Postmark**, and **Plausible/PostHog** — are wired through environment
variables and activate when configured. See `.env.example`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values as integrations come online
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Digital windows (the ecosystem)

| Window | Route | Role |
| --- | --- | --- |
| Akanil | `/akanil` | Parent strategic minerals & trust architecture |
| Founder | `/founder` | Mohamed Nabil — positioning |
| Atlas Mining | `/atlas-mining` | Field-operating proof layer (copper, Morocco) |
| HYRION | `/hyrion` | Evidence & trust governance / data room layer |
| ZYNTRA Deeptech | `/zyntra` | AI mining operations intelligence |
| QASSAS | `/zyntra/qassas` | ZYNTRA product — Mining OS (nested under ZYNTRA) |
| Amusnaw AI | `/amusnaw-ai` | Moroccan smart mining intelligence concept |
| Sustainability | `/sustainability` | Fair resource governance & impact framework |
| Insights | `/insights` | Editorial (CMS-backed in Phase 2) |
| Data Room | `/data-room` | Controlled access request |
| Contact | `/contact` | Institutional briefing request |

## Access request flow

All briefing, contact, data room, and QASSAS demo forms post to
`POST /api/request`. The handler validates input and dispatches an admin
notification:

- With `RESEND_API_KEY` + `ADMIN_NOTIFICATION_EMAIL` set → emails the admin.
- Without them (local/preview) → logs a structured record to the server console,
  so the flow is fully testable without external services.

This is the seam where Supabase persistence (`access_requests`) and the NDA /
admin-review workflow plug in for Phase 3.

## Project structure

```
app/                 # App Router pages + /api/request route
  page.tsx           # Homepage
  <window>/page.tsx  # One file per digital window
components/          # Navbar, Footer, Logo, UI primitives, RequestForm, etc.
lib/site.ts          # Single source of truth: nav, windows, request types, palette
tailwind.config.ts   # Institutional design tokens
```

## Design system

Obsidian black base with muted/copper gold, deep teal, and deep emerald
accents; large confident display headlines; a quiet cultural-geometry grid
motif. Each accent maps to a window family. Tokens live in `tailwind.config.ts`
and `lib/site.ts`.

> Replace the placeholder SVG mark in `components/logo.tsx` with the approved
> Akanil logo asset (gold-on-dark) when available.

## Roadmap

This implements **Phase 1 (Institutional Website MVP)** and the full set of
public window pages from Phase 2. Phases 3–5 (authentication, private document
library, window-based permissions, audit logs, HYRION governance layer, and the
protected QASSAS demo flow) build on the access-request seam and the Supabase /
Sanity environment configuration already scaffolded here.

---

Information on this platform is for general institutional communication only and
is not a public offering, investment solicitation, reserve statement, technical
report, or financial recommendation.
