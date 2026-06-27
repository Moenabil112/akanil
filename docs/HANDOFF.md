# Akanil Platform — Handoff Guide

This document is the single entry point for taking over, running, and preparing
the Akanil platform for production. It consolidates setup, architecture, access
logic, and the pending items required before launch.

> **Status:** development/staging baseline (Phases 1 → 3C). Production Supabase is
> **not** wired. The official logo is **pending** (interim mark in use). No
> production launch yet.

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local      # fill in values as integrations come online
npm run dev                     # http://localhost:3000
```

Scripts: `npm run dev | build | start | lint`.

The app runs fully without any external service:
- **No Supabase** → forms log to the console; admin uses the dev gate; data room
  shows gated/empty states.
- **No Sanity** → public pages render static fallback content.
- **No Resend** → emails are logged to the console.
- **No analytics env** → tracking is a no-op (dev debug log).

## 2. Environment variables

See `.env.example` and `docs/launch/ENVIRONMENT_SETUP.md`. Groups:

| Group | Keys | Required for |
|---|---|---|
| App | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME` | canonical/OG correctness |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | persistence, auth, data room |
| Admin gate (dev) | `ADMIN_DASHBOARD_PASSWORD`, `ADMIN_SESSION_SECRET`, `ADMIN_ALLOWED_EMAILS` | dev admin sign-in |
| Email | `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` | transactional email |
| CMS | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN` | CMS content |
| Analytics | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` or `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` | analytics |
| Security | `DATA_ROOM_SIGNED_URL_EXPIRY_SECONDS` | signed URL TTL |

`SUPABASE_SERVICE_ROLE_KEY` is **server-only** and must never be exposed to the
browser.

## 3. Sanity setup

The studio is a decoupled workspace in `sanity/`:

```bash
cd sanity
npm install
export SANITY_STUDIO_PROJECT_ID=your_project_id   # or reuse NEXT_PUBLIC_SANITY_PROJECT_ID
npm run dev        # studio on :3333
```

Schemas: one document type per public window (`akanilPage`, `founderPage`,
`atlasMiningPage`, `hyrionPage`, `zyntraPage`, `qassasPage`, `amusnawAiPage`,
`sustainabilityPage`) + `insight` + shared objects. The web app reads CMS hero
fields via `lib/sanity/queries.ts` with static fallback — extend field rendering
per page as needed.

## 4. Supabase setup

1. Create a Supabase project; note URL, anon key, service role key.
2. Apply migrations **in order**:

```
supabase/migrations/0001_init.sql               core tables, enums, RLS enable
supabase/migrations/0002_documents_metadata.sql extended doc metadata + private bucket
supabase/migrations/0003_auth_roles_nda.sql     admin roles, auth link, NDA fields
supabase/migrations/0004_governance_tables.sql  governance-patch tables
supabase/migrations/0005_rls_policies.sql       RLS policies + helpers + trigger
```

```bash
supabase db push     # or psql -f each file in order
```

3. Ensure the storage bucket `akanil-data-room` exists and is **private**
   (`0002` creates it). Set `SUPABASE_STORAGE_BUCKET` accordingly.
4. Create at least one admin profile (`profiles.auth_user_id` linked to an
   `auth.users` id, `admin_role = 'super_admin'`).

## 5. Admin roles

Ranked (`lib/auth/roles.ts`): **Super Admin > Platform Admin > Data Room Manager
> Content Manager > Reviewer > Viewer**.

| Capability | Minimum role |
|---|---|
| View admin console | Viewer |
| Review/update request status | Reviewer |
| Manage content (CMS) | Content Manager |
| Documents, NDA, access grants | Data Room Manager |
| Assign admin roles | Platform Admin |

Self role-escalation is blocked by a database trigger.

## 6. Data room access logic

Five access levels = data room layers: `public → institutional_brief →
nda_data_room → technical_review → partner_internal`.

A document is viewable/downloadable when:
- it is `public`, **or**
- the user is a Data Room Manager+ (bypass), **or**
- the user's window permission rank ≥ the document's access level **and**, for
  `nda_data_room` and higher, the user's `nda_status = 'approved'`.

Listings expose only metadata + a `hasFile` flag — **never** `storage_path`.
Locked documents are shown as locked with a CTA, without revealing paths.

## 7. Signed URL flow

`POST /api/data-room/download` `{ documentId }`:
1. Verify Supabase is configured (else 503).
2. Load the document; verify it is active.
3. Resolve the session user; compute their granted level for the window.
4. Authorize (`authorizeDocumentAccess`): window rank ≥ level, NDA when required,
   admin bypass.
5. On denial → 401/403 with a reason; track `signed_url_denied`.
6. On approval → `createSignedUrl(path, EXPIRY)`, write `document_access_logs`,
   track `signed_url_approved`, return `{ url }`.

The raw storage path is never returned.

## 8. Email templates

`lib/email/templates.ts` defines 13 branded templates; `lib/email/send.ts` sends
via Resend or logs in dev fallback and records to `email_logs`:

received (contact / briefing / data room / QASSAS), access under review, access
approved, access rejected, NDA required, NDA received, data room activated,
access expiring soon, QASSAS demo approved, additional information requested.

## 9. Analytics events

`lib/analytics/` — non-invasive, no-op unless Plausible/PostHog is configured,
no tracking cookies:

`briefing_click`, `data_room_request_click`, `qassas_demo_click`,
`contact_submit`, `document_view_attempt`, `signed_url_approved`,
`signed_url_denied`, `admin_approve`, `admin_decline`, `access_level_change`.

## 10. Legal / governance placeholders

`/legal` + `/legal/[slug]` for: privacy, terms, disclaimer, cookies, ip,
data-room-terms, nda-process, claims-disclosure, qassas-disclosure. Each is a
**draft requiring legal review before launch** and is claims-controlled.

## 11. Production readiness

See `docs/launch/` for the full checklists. Before launch:

- Apply migrations `0001`–`0005` to production Supabase.
- Provide and install the official logo (see §13 / Pending).
- Complete legal review of `/legal/*`.
- Complete content review (`docs/launch/CONTENT_READINESS.md`).
- Sign off security (`docs/launch/SECURITY_CHECKLIST.md`).

## 12. Pending items (must be provided / completed by owner)

- [ ] **Official Akanil logo** asset (final SVG/PNG).
- [ ] **Production Supabase** env vars (URL, anon key, service role key).
- [ ] **Production storage bucket** wiring (private `akanil-data-room`).
- [ ] **Final legal review** of `/legal/*`.
- [ ] **Final content review**.
- [ ] **Final launch QA** against production.

## 13. Where to drop the official logo

The logo is centralized — installing the official asset is a one-line change:

1. Add the file to `public/`, e.g. `public/akanil-logo.svg` (gold-on-dark).
2. In `components/logo.tsx`, set:
   ```ts
   export const OFFICIAL_MARK_SRC: string | null = "/akanil-logo.svg";
   ```
   This propagates to the navbar, footer, admin console, 404, and favicon usage.
3. Optionally replace `public/akanil-mark.svg` and `app/icon.svg` with official
   exports for the favicon.

No other files reference the mark directly.
