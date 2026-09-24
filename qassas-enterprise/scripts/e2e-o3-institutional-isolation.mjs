import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase = process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";

const users = {
  atlas: {
    id: "88888888-8888-4888-8888-888888888888",
    username: "atlas_institution_ci",
  },
  artar: {
    id: "99999999-9999-4999-8999-999999999999",
    username: "artar_institution_ci",
  },
  admin: {
    id: "33333333-3333-4333-8333-333333333333",
    username: "system_admin",
  },
};

function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  return fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

async function formToken(url, values) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Token request failed ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body.access_token;
}

async function adminToken() {
  return formToken(
    `${keycloakBase}/realms/master/protocol/openid-connect/token`,
    {
      client_id: "admin-cli",
      grant_type: "password",
      username: process.env.KEYCLOAK_ADMIN ?? "admin",
      password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "change-me",
    },
  );
}

async function setPassword(token, user, password) {
  const response = await fetchWithTimeout(
    `${keycloakBase}/admin/realms/${realm}/users/${user.id}/reset-password`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "password",
        value: password,
        temporary: false,
      }),
    },
  );
  assert.equal(
    response.status,
    204,
    `password reset failed for ${user.username}: ${response.status}`,
  );
}

async function userToken(username, password) {
  return formToken(
    `${keycloakBase}/realms/${realm}/protocol/openid-connect/token`,
    {
      client_id: "qassas-cli",
      grant_type: "password",
      username,
      password,
    },
  );
}

async function apiRequest(token, path) {
  const response = await fetchWithTimeout(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function main() {
  const password = `ci-${randomBytes(18).toString("hex")}`;
  const admin = await adminToken();

  for (const user of Object.values(users)) {
    await setPassword(admin, user, password);
  }

  const [atlasToken, artarToken, systemAdminToken] = await Promise.all([
    userToken(users.atlas.username, password),
    userToken(users.artar.username, password),
    userToken(users.admin.username, password),
  ]);

  const atlasDirectory = await apiRequest(
    atlasToken,
    "/institutional-portfolios",
  );
  assert.equal(atlasDirectory.response.status, 200);
  assert.equal(atlasDirectory.body.institution_count, 1);
  assert.deepEqual(
    atlasDirectory.body.portfolios.map((p) => p.portfolio_id),
    ["PORT-ATLAS-GOLDEN-KSA"],
  );

  const atlasOwn = await apiRequest(
    atlasToken,
    "/institutional-portfolios/PORT-ATLAS-GOLDEN-KSA",
  );
  assert.equal(atlasOwn.response.status, 200);
  assert.equal(
    atlasOwn.body.institution.institution_id,
    "INST-ATLAS-GOLDEN-KSA",
  );

  const atlasCrossTenant = await apiRequest(
    atlasToken,
    "/institutional-portfolios/PORT-ARTAR-KSA",
  );
  assert.equal(atlasCrossTenant.response.status, 404);

  const atlasCrossPipeline = await apiRequest(
    atlasToken,
    "/data-pipeline/portfolios/PORT-ARTAR-KSA/status",
  );
  assert.equal(atlasCrossPipeline.response.status, 404);

  const artarDirectory = await apiRequest(
    artarToken,
    "/institutional-portfolios",
  );
  assert.equal(artarDirectory.response.status, 200);
  assert.equal(artarDirectory.body.institution_count, 1);
  assert.deepEqual(
    artarDirectory.body.portfolios.map((p) => p.portfolio_id),
    ["PORT-ARTAR-KSA"],
  );

  const artarAssets = await apiRequest(
    artarToken,
    "/data-pipeline/portfolios/PORT-ARTAR-KSA/assets",
  );
  assert.equal(artarAssets.response.status, 200);
  assert.equal(artarAssets.body.asset_count, 8);

  const artarCrossTenant = await apiRequest(
    artarToken,
    "/institutional-portfolios/PORT-ATLAS-GOLDEN-KSA",
  );
  assert.equal(artarCrossTenant.response.status, 404);

  const platformDirectory = await apiRequest(
    systemAdminToken,
    "/institutional-portfolios",
  );
  assert.equal(platformDirectory.response.status, 200);
  assert.equal(platformDirectory.body.institution_count, 4);

  const realAccounts = await apiRequest(
    systemAdminToken,
    "/institutional-portfolios",
  );
  assert.equal(
    realAccounts.body.portfolios.every(
      (p) => p.institutional_account.login_enabled === false,
    ),
    true,
    "real institutional accounts must remain disabled until verified IdP binding",
  );

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        atlas_visible_portfolios: 1,
        artar_visible_portfolios: 1,
        platform_visible_portfolios: 4,
        atlas_to_artar_http_status: atlasCrossTenant.response.status,
        artar_to_atlas_http_status: artarCrossTenant.response.status,
        atlas_to_artar_pipeline_http_status: atlasCrossPipeline.response.status,
        artar_public_assets: artarAssets.body.asset_count,
        real_institutional_accounts_login_enabled: false,
      },
      null,
      2,
    ),
  );
}

await main();
