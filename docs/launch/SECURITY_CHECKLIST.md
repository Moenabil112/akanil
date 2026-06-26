# Akanil — Security Checklist

## Authentication & sessions

- [ ] Supabase Auth enabled; dev HMAC admin gate disabled in production (or
      restricted via `ADMIN_ALLOWED_EMAILS`).
- [ ] `ADMIN_SESSION_SECRET` is a strong, unique value.
- [ ] Session cookies are `httpOnly`, `secure`, `sameSite=lax`.

## Authorization (RLS)

- [ ] RLS enabled and deny-by-default on all 16 tables.
- [ ] Helper functions are `security definer` with fixed `search_path`.
- [ ] Self role-escalation trigger active on `profiles`.
- [ ] anon can only INSERT public-form rows; cannot read private data.
- [ ] Authenticated users see only their own rows + permitted documents.

## Data room & storage

- [ ] Storage bucket `akanil-data-room` is private (`public = false`).
- [ ] No raw `storage_path` ever returned to a client.
- [ ] Signed URLs are short-lived (`DATA_ROOM_SIGNED_URL_EXPIRY_SECONDS`).
- [ ] Every download passes session → window permission → access level → NDA.
- [ ] All downloads recorded in `document_access_logs`.

## Secrets & exposure

- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used server-side; never shipped to client.
- [ ] No secrets in the repo; `.env*` git-ignored.
- [ ] `robots.txt` disallows `/admin`, `/api`, and private data room routes.
- [ ] Private/admin pages set `robots: noindex`.

## Transport & headers

- [ ] HTTPS enforced.
- [ ] Consider adding CSP / security headers at the edge before launch.
