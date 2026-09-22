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

async function post(token, path, body, headers = {}) {
  const response = await fetch(apiBase + path, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  return { response, body: parsed };
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

  console.log("S2 E2E: Exploration Director operational interface");
  const explorationOps = await get(
    directorToken,
    "/pilot-operations/exploration",
  );
  assert.equal(explorationOps.response.status, 200);
  assert.equal(explorationOps.body.interface, "EXPLORATION_DIRECTOR");
  assert.equal(explorationOps.body.visible_asset_count, 5);
  assert.deepEqual(
    explorationOps.body.assets.map((asset) => asset.decision_object_key),
    ["DO-001", "DO-002", "DO-003", "DO-004", "DO-005"],
  );
  for (const asset of explorationOps.body.assets) {
    assert.equal(typeof asset.next_controlled_action, "string");
    assert.ok(asset.next_controlled_action.length > 0);
  }

  console.log("S2 E2E: Finance operational minimisation");
  const financeOps = await get(financeToken, "/pilot-operations/finance");
  assert.equal(financeOps.response.status, 200);
  assert.equal(financeOps.body.interface, "FINANCE");
  assert.equal(financeOps.body.visible_asset_count, 5);
  for (const asset of financeOps.body.assets) {
    assert.equal(Object.hasOwn(asset, "evidence"), false);
    assert.equal(Object.hasOwn(asset, "blocking_gap_count"), false);
    assert.equal(Object.hasOwn(asset, "blocking_conflict_count"), false);
    assert.equal(Object.hasOwn(asset, "recommendation_id"), false);
    assert.equal(Object.hasOwn(asset, "capital_state"), true);
  }

  console.log("S2 E2E: JV operational anti-inference and field minimisation");
  const jvOps = await get(partnerToken, "/pilot-operations/jv");
  assert.equal(jvOps.response.status, 200);
  assert.equal(jvOps.body.interface, "JV_REVIEW");
  assert.equal(jvOps.body.visible_asset_count, 1);
  assert.equal(jvOps.body.assets.length, 1);
  assert.equal(jvOps.body.assets[0].asset_id, "LIC-AHN-001");
  assert.equal(jvOps.body.assets[0].decision_object_key, "DO-003");
  assert.equal(Object.hasOwn(jvOps.body.assets[0], "capital_state"), false);
  assert.equal(Object.hasOwn(jvOps.body.assets[0], "requested_amount"), false);
  assert.ok(Array.isArray(jvOps.body.assets[0].reserved_matters));
  assert.ok(jvOps.body.assets[0].reserved_matters.length >= 1);

  console.log("S2 E2E: System Admin denied operational business interfaces");
  for (const path of [
    "/pilot-operations/exploration",
    "/pilot-operations/finance",
    "/pilot-operations/jv",
  ]) {
    const denied = await get(adminUserToken, path);
    assert.equal(denied.response.status, 404);
  }

  console.log("S2 E2E: open all remaining governed Pilot Decision Objects");

  const pilotDecisionSpecs = [
    {
      key: "DO-001",
      target_id: "TGT-UHM-VMS-001",
      decision_class: "MRE_READINESS",
      current_gate: "G7_RESOURCE_DEFINITION",
      workflow_template_code: "WT-MRE-READINESS",
      question: "Is Umm Hijlan / Mamilah evidence controlled enough for MRE readiness review?",
    },
    {
      key: "DO-003",
      target_id: "TGT-AHN-PORT-001",
      decision_class: "MULTI_TARGET_PORTFOLIO",
      current_gate: "G2_TARGET_GENERATED",
      workflow_template_code: "WT-MULTI-TARGET-JV",
      question: "Which Al Hajar North target should receive the next controlled test under JV constraints?",
    },
    {
      key: "DO-004",
      target_id: "TGT-AG-GROWTH-001",
      decision_class: "INCREMENTAL_RESOURCE_VALUE",
      current_gate: "G8_RESOURCE_GROWTH",
      workflow_template_code: "WT-RESOURCE-GROWTH-VOI",
      question: "Does the next Al Godeyer extension test justify its incremental information value?",
    },
    {
      key: "DO-005",
      target_id: "TGT-JAD-COVERED-001",
      decision_class: "COVERED_TARGET_TEST",
      current_gate: "G2_TARGET_GENERATED",
      workflow_template_code: "WT-COVERED-TARGET-TEST",
      question: "Which covered-target method should be tested next at Jadib Al Qahtanah?",
    },
  ];

  const openedByKey = new Map();

  for (const spec of pilotDecisionSpecs) {
    const opened = await post(
      directorToken,
      "/decisions",
      {
        target_id: spec.target_id,
        decision_class: spec.decision_class,
        decision_question: spec.question,
        trigger_type: "SPRINT2_FIVE_ASSET_E2E",
        current_gate: spec.current_gate,
      },
      {
        "x-qassas-idempotency-key": "S2-" + spec.key + "-OPEN",
        "x-qassas-correlation-id": "CORR-S2-" + spec.key,
      },
    );

    assert.ok(
      [200, 201].includes(opened.response.status),
      spec.key + " should open successfully",
    );
    assert.equal(opened.body.decision_class, spec.decision_class);
    assert.equal(opened.body.current_gate, spec.current_gate);
    assert.equal(
      opened.body.workflow_template_code,
      spec.workflow_template_code,
    );
    assert.equal(opened.body.state, "CREATED");
    openedByKey.set(spec.key, opened.body.decision_id);
  }

  const liveQueue = await get(directorToken, "/pilot-decision-queue");
  assert.equal(liveQueue.response.status, 200);
  assert.equal(liveQueue.body.visible_asset_count, 5);

  const liveByKey = new Map(
    liveQueue.body.decisions.map((item) => [item.decision_object_key, item]),
  );

  for (const spec of pilotDecisionSpecs) {
    const item = liveByKey.get(spec.key);
    assert.ok(item, spec.key + " must exist in live queue");
    assert.equal(item.decision_id, openedByKey.get(spec.key));
    assert.equal(item.decision_state, "CREATED");
    assert.equal(item.decision_gate, spec.current_gate);
    assert.notEqual(item.queue_state, "NOT_STARTED");
  }

  const abuSalalLive = liveByKey.get("DO-002");
  assert.ok(abuSalalLive);
  assert.ok(
    abuSalalLive.decision_id,
    "DO-002 Abu Salal must remain live through Sprint 0/1 regression flow",
  );

  assert.equal(
    [...liveByKey.values()].filter((item) => item.decision_id !== null).length,
    5,
    "all five Pilot Decision Objects must have a live governed Decision context",
  );

  console.log("S2 E2E: Mamilah remains a separate governed target");
  const mamilah = await get(directorToken, "/pilot-assets/LIC-UHM-001");
  assert.equal(mamilah.response.status, 200);
  assert.equal(mamilah.body.primary_target_id, "TGT-UHM-VMS-001");
  assert.deepEqual(mamilah.body.secondary_target_ids, ["TGT-MAM-GOLD-001"]);

  console.log("S2 E2E: stage-specific Pilot workflow enforcement");
  const wrongGate = await post(
    directorToken,
    "/decisions",
    {
      target_id: "TGT-JAD-COVERED-001",
      decision_class: "COVERED_TARGET_TEST",
      decision_question: "Which covered-target method should be tested next?",
      trigger_type: "SPRINT2_STAGE_VALIDATION",
      current_gate: "G5_DRILL_READY",
    },
    {
      "x-qassas-idempotency-key": "S2-JAD-WRONG-GATE",
      "x-qassas-correlation-id": "CORR-S2-JAD-WRONG-GATE",
    },
  );
  assert.equal(wrongGate.response.status, 409);
  assert.equal(wrongGate.body.code, "QAS-PILOT-WORKFLOW-MISMATCH");

  const jadibLive = liveByKey.get("DO-005");
  assert.ok(jadibLive);
  assert.equal(jadibLive.decision_id, openedByKey.get("DO-005"));
  assert.equal(jadibLive.decision_class, "COVERED_TARGET_TEST");
  assert.equal(jadibLive.decision_gate, "G2_TARGET_GENERATED");

  console.log("E2E-S2-MULTI-ASSET-001 PASS");
}

await main();
