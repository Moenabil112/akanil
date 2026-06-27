# Akanil — Launch Checklist

> Master checklist for taking the Akanil platform from development to a public
> launch. Nothing here wires production automatically — production Supabase and
> the official logo are provided by the owner separately.

## Pre-launch gates

- [ ] Official Akanil logo installed (`public/akanil-logo.svg`, `OFFICIAL_MARK_SRC` set). _Pending — interim mark in use._
- [ ] Production Supabase project created and env vars provided. _Pending._
- [ ] All migrations applied in order (`0001` → `0005`).
- [ ] Legal pages reviewed and approved by counsel (see `/legal/*`).
- [ ] Content reviewed against approved positioning (`CONTENT_READINESS.md`).
- [ ] Security checklist signed off (`SECURITY_CHECKLIST.md`).
- [ ] Data room readiness signed off (`DATA_ROOM_READINESS.md`).

## Build & deploy

- [ ] `npm run build` passes with no type errors.
- [ ] `npm run lint` clean.
- [ ] Environment variables set in the hosting platform (`ENVIRONMENT_SETUP.md`).
- [ ] Custom domain + HTTPS configured.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production URL (canonical/OG correctness).

## Post-deploy verification

- [ ] Public pages render and pass the smoke checklist.
- [ ] `/sitemap.xml` and `/robots.txt` resolve correctly.
- [ ] Open Graph / Twitter previews render (validate with a share debugger).
- [ ] Contact / briefing / data room / QASSAS forms submit and notify admins.
- [ ] Admin console reachable and gated; a real admin can sign in.
- [ ] Data room: a test user sees only permitted documents; downloads are logged.
- [ ] No raw storage paths appear in any network response.

## Rollback

- [ ] Previous deployment retained for one-click rollback.
- [ ] Database migration rollback notes prepared for `0005` → `0001`.
