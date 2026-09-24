# QASSAS Institutional Portfolio Workbench

This is the O3C frontend baseline for the QASSAS institutional product.

## Run locally

1. Start the QASSAS API, Keycloak, OPA, Temporal and PostgreSQL.
2. Ensure the local Keycloak realm contains the `qassas-web` public OIDC client.
3. Start this workbench:

```bash
node workbench/server.mjs
```

4. Open `http://localhost:3000`.

The browser uses Authorization Code + PKCE. Access tokens are kept only in
`sessionStorage` and are not persisted across browser sessions.

## Runtime data

The Workbench reads:

- `GET /api/v1/institutional-portfolios`
- `GET /api/v1/institutional-portfolios/:portfolioId`
- `GET /api/v1/data-pipeline/portfolios/:portfolioId/status`
- `GET /api/v1/data-pipeline/portfolios/:portfolioId/assets`

The UI adapts to the backend-provided `ui_profile` and portfolio scale class.

## Security boundary

The institution selector is not an authorisation boundary. The API only returns
portfolios resolved from the authenticated user's institutional memberships.

No private source is rendered as available while its access state remains
`TERM_SHEET_REQUIRED`.

## Production boundary

The static PKCE client is acceptable for the O3C/UAT baseline. Production may
move to a BFF/session-cookie architecture if the final hosting/security review
requires it. Protected redirect URIs and web origins must be explicit; wildcards
must not be introduced.
