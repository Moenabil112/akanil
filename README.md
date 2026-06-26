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
`POST /api/request`. The handler validates input, **persists it to the matching
Supabase table**, records an audit entry, then dispatches an admin notification:

| Form source | Supabase table |
| --- | --- |
| Data Room | `access_requests` |
| Briefing | `briefing_requests` |
| Contact | `contact_messages` |
| QASSAS demo (request type) | `qassas_demo_requests` |

- With Supabase env vars set → the request is stored and shows up in the admin
  dashboard; an `audit_logs` row is written.
- With `RESEND_API_KEY` + `ADMIN_NOTIFICATION_EMAIL` set → emails the admin and
  writes an `email_logs` row.
- With neither configured (local/preview) → logs a structured record to the
  server console, so the flow stays fully testable without external services.

## Database (Supabase)

The institutional access backend is defined in `supabase/migrations/0001_init.sql`
(tables follow `08_Akanil_Backend_Recommendation_EN.md` + `13_*.sql`):

`organizations`, `profiles`, `access_requests`, `briefing_requests`,
`qassas_demo_requests`, `contact_messages`, `documents`, `document_access_logs`,
`nda_records`, `window_permissions`, `audit_logs`, `email_logs`.

RLS is enabled and **deny-by-default** on every table. The site reads/writes only
through the service-role key on the server; the anon key never touches these
tables. Authenticated partner/end-user policies + Supabase Auth arrive in Phase 3.

```bash
# with the Supabase CLI and a linked project
supabase db push                # or: psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

Then set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Data Room layers

The five access levels (`access_level` enum) are the Data Room structure:
**Public → Institutional Brief → NDA Data Room → Technical Review →
Partner / Internal**. Documents carry an `access_level` and a `storage_path`
that is never exposed. **Private file access is gated**: the admin manages
metadata only; authenticated, NDA-checked signed-URL delivery is Phase 3.

## Admin dashboard

A custom review console lives under `/admin`, gated by middleware. Modules:
overview, access requests, briefings, QASSAS demos, contacts, organizations,
documents (metadata), and the audit log. Request statuses are updated inline via
server actions that also write to `audit_logs`.

Sign-in (`/admin/login`) checks `ADMIN_DASHBOARD_PASSWORD` and, if set, an email
allow-list (`ADMIN_ALLOWED_EMAILS`), then issues an HMAC-signed session cookie
(`ADMIN_SESSION_SECRET`). This is a deliberately minimal Phase 2A gate — full
Supabase Auth + role-based access control replaces it in Phase 3.

```bash
ADMIN_DASHBOARD_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=long-random-string
ADMIN_ALLOWED_EMAILS=you@example.com   # optional allow-list
```

## Known issues

- **Notification fallback logging (non-blocking).** When `RESEND_API_KEY` /
  `ADMIN_NOTIFICATION_EMAIL` are not set, request notifications are written to
  the server console (`console.info("[akanil] request received: …")`) instead of
  emailed. Requests are still persisted to Supabase (when configured) and visible
  in the admin dashboard — no submissions are lost — but admins are not actively
  notified until an email provider is configured. Resolve by setting the Resend
  variables in production.
- **Logo is an interim reproduction.** `components/logo.tsx` /
  `public/akanil-mark.svg` are a faithful hand-traced rendition of the official
  mark, not the approved vector (no logo asset was included in the knowledge
  package). Replace with the official gold-on-dark SVG to lock exact proportions.

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

- **Phase 1 — Institutional Website MVP** ✅ public windows, request flows.
- **Phase 2A — Persistence + Admin + Logo** ✅ Supabase migration, request
  persistence, audit logs, the `/admin` review dashboard, Data Room layer
  schema (files gated), interim official-logo reproduction.
- **Phase 2B — next:** Sanity CMS schemas for the public windows + Insights,
  document upload/metadata editing in admin.
- **Phase 3 — Controlled Data Room:** Supabase Auth, NDA workflow, window
  permissions, signed-URL file delivery, download audit logging.
- **Phase 4–5 — HYRION governance layer + protected QASSAS demo flow.**

---

Information on this platform is for general institutional communication only and
is not a public offering, investment solicitation, reserve statement, technical
report, or financial recommendation.
