# Akanil — Production Readiness Checklist

## Application

- [ ] `npm run build` and `npm run lint` pass in CI.
- [ ] All routes verified; no renamed/broken routes (QASSAS stays `/zyntra/qassas`).
- [ ] Static fallbacks active for CMS-off and Supabase-off states.
- [ ] Error/404 pages styled and informative.

## Performance

- [ ] Public pages are statically rendered where possible.
- [ ] Fonts loaded via `next/font` (no layout shift).
- [ ] Images optimized; official logo asset provided as SVG.

## Reliability

- [ ] Form submissions persist even if email dispatch fails.
- [ ] Signed-URL generation failures degrade gracefully.
- [ ] Audit and access logs writing successfully.

## Observability

- [ ] Analytics configured (Plausible/PostHog) or intentionally disabled.
- [ ] Admin audit log reviewed for completeness.
- [ ] Server logs captured by the hosting platform.

## Handoff

- [ ] Owner provides production Supabase env vars.
- [ ] Owner provides official logo asset.
- [ ] Legal sign-off recorded.
- [ ] DNS, HTTPS, and domain verification complete.
