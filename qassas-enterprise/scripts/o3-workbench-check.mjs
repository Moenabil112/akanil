import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const files = [
  "workbench/app.js",
  "workbench/api.js",
  "workbench/auth.js",
  "workbench/config.js",
  "workbench/server.mjs",
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `${file} syntax check failed: ${result.stderr || result.stdout}`,
  );
}

const app = await readFile("workbench/app.js", "utf8");
const api = await readFile("workbench/api.js", "utf8");
const auth = await readFile("workbench/auth.js", "utf8");
const html = await readFile("workbench/index.html", "utf8");
const css = await readFile("workbench/styles.css", "utf8");
const realm = JSON.parse(
  await readFile("keycloak/realm/qassas-pilot-realm.json", "utf8"),
);

for (const required of [
  "ADAPTIVE_ONBOARDING",
  "LARGE_PORTFOLIO",
  "ENTERPRISE_PORTFOLIO",
  "renderPartnerLayer",
]) {
  assert.ok(app.includes(required), `Workbench missing adaptive behavior: ${required}`);
}

for (const required of [
  "/institutional-portfolios",
  "/data-pipeline/portfolios/",
]) {
  assert.ok(api.includes(required), `Workbench API client missing route: ${required}`);
}

assert.ok(
  html.includes("TERM SHEET REQUIRED") ||
    html.includes("Partner & Term Sheet Layer"),
  "Term Sheet surface is required",
);
assert.ok(
  html.includes("It cannot create a geological Target"),
  "Public-data non-authority boundary must be visible",
);

assert.ok(auth.includes("code_challenge_method"), "PKCE challenge method is required");
assert.ok(auth.includes("S256"), "PKCE S256 is required");
assert.ok(!auth.includes("localStorage"), "Access tokens must not use localStorage");
assert.ok(html.includes("Institutional Portfolio Workbench"));
assert.ok(css.includes("@media (max-width: 780px)"), "Mobile breakpoint is required");

const webClient = realm.clients.find((client) => client.clientId === "qassas-web");
assert.ok(webClient, "qassas-web Keycloak client is required");
assert.equal(webClient.publicClient, true);
assert.equal(webClient.standardFlowEnabled, true);
assert.equal(webClient.directAccessGrantsEnabled, false);
assert.equal(
  webClient.attributes?.["pkce.code.challenge.method"],
  "S256",
  "qassas-web must enforce PKCE S256",
);
assert.ok(
  webClient.protocolMappers?.some(
    (mapper) =>
      mapper.protocolMapper === "oidc-audience-mapper" &&
      mapper.config?.["included.client.audience"] === "qassas-api" &&
      mapper.config?.["access.token.claim"] === "true",
  ),
  "qassas-web access token must include qassas-api audience",
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      syntax: "PASS",
      oidc_pkce: "PASS",
      qassas_api_audience: "PASS",
      token_storage: "SESSION_ONLY",
      adaptive_portfolio_ui: "PASS",
      responsive_ui: "PASS",
      private_term_sheet_surface: "PASS",
    },
    null,
    2,
  ),
);
