# Akanil — Environment Setup Checklist

Copy `.env.example` to `.env.local` (development) or set these in the hosting
platform (production). The app degrades gracefully when optional groups are
absent — see "Known issues" in the README.

## App

- [ ] `NEXT_PUBLIC_SITE_URL` — canonical base URL (affects OG, canonical, sitemap).
- [ ] `NEXT_PUBLIC_SITE_NAME` — defaults to `Akanil`.

## Supabase (database + auth + storage) — _provided by owner at handoff_

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed)
- [ ] `SUPABASE_STORAGE_BUCKET` (default `akanil-data-room`, private)
- [ ] Migrations applied: `0001` → `0005`.

## Admin gate (development fallback)

- [ ] `ADMIN_DASHBOARD_PASSWORD`
- [ ] `ADMIN_SESSION_SECRET`
- [ ] `ADMIN_ALLOWED_EMAILS` (optional allow-list)

## Email (Resend) — optional; dev falls back to console

- [ ] `RESEND_API_KEY`
- [ ] `ADMIN_NOTIFICATION_EMAIL`

## CMS (Sanity) — optional; pages fall back to static content

- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID`
- [ ] `NEXT_PUBLIC_SANITY_DATASET`
- [ ] `SANITY_API_READ_TOKEN`

## Analytics — optional; no tracking unless set

- [ ] `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` or `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST`

## Security

- [ ] `DATA_ROOM_SIGNED_URL_EXPIRY_SECONDS` (default 3600)
- [ ] All secrets stored in the platform secret manager, not committed.
