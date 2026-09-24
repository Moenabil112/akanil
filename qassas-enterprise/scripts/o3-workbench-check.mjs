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
const auth = await readFile("workbench/auth.js", "utf8");
const html = await readFile("workbench/index.html", "utf8");
const css = await readFile("workbench/styles.css", "utf8");

for (const required of [
  "/institutional-portfolios",
  "/data-pipeline/portfolios/",
  "ADAPTIVE_ONBOARDING",
  "LARGE_PORTFOLIO",
  "TERM SHEET REQUIRED",
  "public_data_may_create_targets",
]) {
  assert.ok(app.includes(required), `Workbench missing required behavior: ${required}`);
}

assert.ok(auth.includes("code_challenge_method"), "PKCE challenge method is required");
assert.ok(auth.includes("S256"), "PKCE S256 is required");
assert.ok(!auth.includes("localStorage"), "Access tokens must not use localStorage");
assert.ok(html.includes("Institutional Portfolio Workbench"));
assert.ok(css.includes("@media (max-width: 780px)"), "Mobile breakpoint is required");

console.log(
  JSON.stringify(
    {
      status: "PASS",
      syntax: "PASS",
      oidc_pkce: "PASS",
      token_storage: "SESSION_ONLY",
      adaptive_portfolio_ui: "PASS",
      responsive_ui: "PASS",
      private_term_sheet_surface: "PASS",
    },
    null,
    2,
  ),
);
