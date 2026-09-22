import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase =
  process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";

const users = {
  director: {
    id: "22222222-2222-4222-8222-222222222222",
    username: "exploration_director",
  },
  admin: {
    id: "33333333-3333-4333-8333-333333333333",
    username: "system_admin",
  },
  partner: {
    id: "44444444-4444-4444-8444-444444444444",
    username: "partner_user",
  },
  finance: {
    id: "55555555-5555-4555-8555-555555555555",
    username: "finance_reviewer",
  },
};

async function formToken(url, values) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      "Token request failed " + response.status + ": " + JSON.stringify(body),
    );
  }
  return body.access_token;
}

async function adminToken() {
  return formToken(
    keycloakBase + "/realms/master/protocol/openid-connect/token",
    {
      client_id: "admin-cli",
      grant_type: "password",
      username: process.env.KEYCLOAK_ADMIN ?? "admin",
      password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "change-me",
    },
  );
}

async function prepareUser(token, user, password) {
  const response = await fetch(
    keycloakBase +
      "/admin/realms/" +
      realm +
      "/users/" +
      user.id +
      "/reset-password",
    {
      method: "PUT",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "password",
        value: password,
        temporary: false,
      }),
    },
  );
  assert.equal(response.status, 204);
}

async function userToken(username, password) {
  return formToken(
    keycloakBase +
      "/realms/" +
      realm +
      "/protocol/openid-connect/token",
    {
      client_id: "qassas-cli",
      grant_type: "password",
      username,
      password,
    },
  );
}

async function get(token, path) {
  const response = await fetch(apiBase + path, {
    headers: { authorization: "Bearer " + token },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function main() {
  const password = "s2-" + randomBytes(18).toString("hex");
  const admin = await adminToken();

  for (const user of Object.values(users)) {
    await prepareUser(admin, user, password);
  }

  const [directorToken, adminUserToken, partnerToken, financeToken] =
    await Promise.all([
      userToken(users.director.username, password),
      userToken(users.admin.username, password),
      userToken(users.partner.username, password),
      userToken(users.finance.username, password),
    ]);

  console.log("S2 E2E: Exploration Director five-asset registry");
  const directorAssets = await get(directorToken, "/pilot-assets");
  assert.equal(directorAssets.response.status, 200);
  assert.equal(directorAssets.body.visible_asset_count, 5);

  const keys = directorAssets.body.assets.map(
    (asset) => asset.decision_object_key,
  );
  assert.deepEqual(keys, ["DO-001", "DO-002", "DO-003", "DO-004", "DO-005"]);

  const uhm = directorAssets.body.assets.find(
    (asset) => asset.decision_object_key === "DO-001",
  );
  assert.ok(uhm);
  assert.equal(uhm.asset_name, "Umm Hijlan / Mamilah");
  assert.deepEqual(uhm.secondary_target_ids, ["TGT-MAM-GOLD-001"]);
  assert.equal(uhm.workflow_template.template_code, "WT-MRE-READINESS");

  const ag = directorAssets.body.assets.find(
    (asset) => asset.decision_object_key === "DO-004",
  );
  assert.equal(ag.configured_gate, "G8_RESOURCE_GROWTH");
  assert.equal(
    ag.workflow_template.template_code,
    "WT-RESOURCE-GROWTH-VOI",
  );

  const jad = directorAssets.body.assets.find(
    (asset) => asset.decision_object_key === "DO-005",
  );
  assert.equal(
    jad.workflow_template.configuration.historical_grade_not_drill_ready,
    true,
  );

  console.log("S2 E2E: workflow templates are stage-specific");
  const templates = await get(directorToken, "/pilot-workflow-templates");
  assert.equal(templates.response.status, 200);
  assert.equal(templates.body.templates.length, 5);

  const templateCodes = new Set(
    templates.body.templates.map((template) => template.template_code),
  );
  for (const code of [
    "WT-MRE-READINESS",
    "WT-DISCOVERY-TO-RESOURCE",
    "WT-MULTI-TARGET-JV",
    "WT-RESOURCE-GROWTH-VOI",
    "WT-COVERED-TARGET-TEST",
  ]) {
    assert.equal(templateCodes.has(code), true);
  }

  console.log("S2 E2E: multi-asset Decision Queue");
  const queue = await get(directorToken, "/pilot-decision-queue");
  assert.equal(queue.response.status, 200);
  assert.equal(queue.body.visible_asset_count, 5);
  assert.deepEqual(
    queue.body.decisions.map((item) => item.decision_object_key),
    ["DO-001", "DO-002", "DO-003", "DO-004", "DO-005"],
  );

  const neverStarted = queue.body.decisions.filter(
    (item) =>
      ["DO-001", "DO-004", "DO-005"].includes(item.decision_object_key) &&
      item.queue_state === "NOT_STARTED",
  );
  assert.equal(neverStarted.length, 3);

  console.log("S2 E2E: JV anti-inference");
  const partnerAssets = await get(partnerToken, "/pilot-assets");
  assert.equal(partnerAssets.response.status, 200);
  assert.equal(partnerAssets.body.visible_asset_count, 1);
  assert.equal(partnerAssets.body.assets[0].asset_id, "LIC-AHN-001");
  assert.equal(partnerAssets.body.assets[0].decision_object_key, "DO-003");

  const partnerQueue = await get(partnerToken, "/pilot-decision-queue");
  assert.equal(partnerQueue.response.status, 200);
  assert.equal(partnerQueue.body.visible_asset_count, 1);
  assert.equal(partnerQueue.body.decisions[0].asset_id, "LIC-AHN-001");

  const partnerTemplates = await get(
    partnerToken,
    "/pilot-workflow-templates",
  );
  assert.equal(partnerTemplates.response.status, 200);
  assert.equal(partnerTemplates.body.templates.length, 1);
  assert.equal(
    partnerTemplates.body.templates[0].template_code,
    "WT-MULTI-TARGET-JV",
  );

  console.log("S2 E2E: System Admin separation");
  const adminAssets = await get(adminUserToken, "/pilot-assets");
  assert.equal(adminAssets.response.status, 200);
  assert.equal(adminAssets.body.visible_asset_count, 0);
  assert.deepEqual(adminAssets.body.assets, []);

  const adminQueue = await get(adminUserToken, "/pilot-decision-queue");
  assert.equal(adminQueue.response.status, 200);
  assert.equal(adminQueue.body.visible_asset_count, 0);
  assert.deepEqual(adminQueue.body.decisions, []);

  console.log("S2 E2E: Finance portfolio visibility");
  const financeAssets = await get(financeToken, "/pilot-assets");
  assert.equal(financeAssets.response.status, 200);
  assert.equal(financeAssets.body.visible_asset_count, 5);

  console.log("E2E-S2-MULTI-ASSET-001 PASS");
}

await main();
