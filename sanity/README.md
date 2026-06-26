# Akanil Sanity Studio

Structured content for the public digital windows. This is a **separate
workspace** from the Next.js app so the web build stays decoupled from the CMS
toolchain.

## Run locally

```bash
cd sanity
npm install
export SANITY_STUDIO_PROJECT_ID=your_project_id   # or reuse NEXT_PUBLIC_SANITY_PROJECT_ID
export SANITY_STUDIO_DATASET=production
npm run dev        # studio at http://localhost:3333
```

## Schemas

Shared objects (`seo`, `ctaButton`, `featureItem`, `pillar`) plus one document
type per public window:

`akanilPage`, `founderPage`, `atlasMiningPage`, `hyrionPage`, `zyntraPage`,
`qassasPage`, `amusnawAiPage`, `sustainabilityPage`, and `insight` (articles).

Each window document carries hero fields (title, slug, eyebrow, intro, core
message), a portable-text body, structured lists specific to that window, CTA
buttons, and SEO.

## Wiring into the web app (next phase)

The Next pages currently render static content. To make them CMS-driven, add a
read client in the app (`@sanity/client`) using `NEXT_PUBLIC_SANITY_*` and
`SANITY_API_READ_TOKEN`, then fetch the matching window document per route. The
field names above map 1:1 to the existing page sections.
