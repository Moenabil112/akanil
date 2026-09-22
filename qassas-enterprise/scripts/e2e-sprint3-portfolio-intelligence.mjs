import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const apiBase =
  process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase =
  process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";
const runId = process.env.GITHUB_RUN_ID ?? Date.now().toString();

const users = {
  geo: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "senior_geologist",
  },
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

async function request(token, method, path, body, headers = {}) {
  const response = await fetch(apiBase + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { response, body: parsed };
}

const get = (token, path) => request(token, "GET", path);
const post = (token, path, body, headers = {}) =>
  request(token, "POST", path, body, headers);

async function main() {
  const password = "s3-" + randomBytes(18).toString("hex");
  const admin = await adminToken();

  for (const user of Object.values(users)) {
    await prepareUser(admin, user, password);
  }

  const [geoToken, directorToken, adminUserToken, partnerToken] =
    await Promise.all([
      userToken(users.geo.username, password),
      userToken(users.director.username, password),
      userToken(users.admin.username, password),
      userToken(users.partner.username, password),
    ]);

  console.log("S3 E2E: five-asset Control Board with transparent scoring");
  const board = await get(
    directorToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(board.response.status, 200);
  assert.equal(board.body.interface, "CONTROL_BOARD");
  assert.equal(board.body.visible_asset_count, 5);
  assert.equal(board.body.ranked_asset_count, 5);
  assert.equal(board.body.scoring_model.model_code, "PPI");
  assert.equal(board.body.scoring_model.model_version, 1);
  assert.equal(board.body.policy.ranking_is_advisory, true);
  assert.equal(board.body.policy.score_authorises_execution, false);
  assert.equal(board.body.policy.blockers_dominate_execution, true);

  assert.deepEqual(
    board.body.assets.map((asset) => asset.prioritisation.priority_rank),
    [1, 2, 3, 4, 5],
  );

  for (const asset of board.body.assets) {
    assert.equal(
      asset.prioritisation.score_authorises_execution,
      false,
    );
    assert.ok(
      asset.prioritisation.portfolio_priority_index >= 0 &&
        asset.prioritisation.portfolio_priority_index <= 100,
    );
    assert.ok(asset.prioritisation.voi_points_per_million_sar >= 0);

    const dimensions = asset.assessment.dimensions;
    assert.deepEqual(Object.keys(dimensions).sort(), [
      "cost_to_next_decision",
      "data_quality",
      "evidence_confidence",
      "geological_potential",
      "partner_constraint",
      "scale_potential",
      "strategic_adjacency",
      "technical_maturity",
      "work_commitment_risk",
    ]);
  }

  const byKey = new Map(
    board.body.assets.map((asset) => [asset.decision_object_key, asset]),
  );

  const alGodeyer = byKey.get("DO-004");
  const jadib = byKey.get("DO-005");
  assert.ok(alGodeyer);
  assert.ok(jadib);

  console.log("S3 E2E: PPI and VoI are different decision lenses");
  assert.equal(
    alGodeyer.prioritisation.priority_rank,
    1,
    "Al Godeyer should be highest PPI in the synthetic calibration",
  );

  const maxVoi = Math.max(
    ...board.body.assets.map(
      (asset) => asset.prioritisation.voi_points_per_million_sar,
    ),
  );
  assert.equal(
    jadib.prioritisation.voi_points_per_million_sar,
    maxVoi,
    "Jadib should carry the highest synthetic VoI per SAR",
  );
  assert.notEqual(
    alGodeyer.asset_id,
    jadib.asset_id,
    "PPI leader and VoI leader must differ in the Pilot demonstration",
  );

  console.log("S3 E2E: Jadib high VoI does not make it Drill Ready");
  assert.equal(jadib.configured_gate, "G2_TARGET_GENERATED");
  assert.equal(jadib.decision_gate, "G2_TARGET_GENERATED");
  assert.notEqual(jadib.decision_gate, "G5_DRILL_READY");

  console.log("S3 E2E: Control Board rejects Partner/System Admin business access");
  const partnerDenied = await get(
    partnerToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(partnerDenied.response.status, 404);

  const adminDenied = await get(
    adminUserToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(adminDenied.response.status, 404);

  console.log("S3 E2E: high PPI cannot bypass governed Capital controls");
  assert.ok(
    alGodeyer.decision_id,
    "Sprint 2 must provide a live DO-004 Decision context",
  );
  const correlationId = "CORR-S3-PPI-BLOCK-" + runId;

  const requestResult = await post(
    geoToken,
    "/capital/requests",
    {
      decision_id: alGodeyer.decision_id,
      capital_type: "DECISION_CAPITAL",
      requested_amount: 2500000,
      currency: "SAR",
      purpose:
        "Sprint 3 proof that portfolio rank cannot bypass delegated capital authority.",
      funding_source: "SPRINT3_SYNTHETIC",
    },
    {
      "x-qassas-idempotency-key": "S3-AG-CAP-" + runId,
      "x-qassas-correlation-id": correlationId,
    },
  );
  assert.ok([200, 201].includes(requestResult.response.status));
  assert.equal(requestResult.body.state, "REQUESTED");

  const assessed = await post(
    directorToken,
    "/capital/requests/" +
      requestResult.body.capital_request_id +
      "/assess",
    undefined,
    {
      "if-match": "1",
      "x-qassas-idempotency-key": "S3-AG-CAP-ASSESS-" + runId,
      "x-qassas-correlation-id": correlationId,
    },
  );
  assert.ok([200, 201].includes(assessed.response.status));
  assert.equal(assessed.body.state, "BLOCKED");
  assert.equal(assessed.body.authorityGate, false);
  assert.ok(
    assessed.body.blockingReasons.includes("AUTHORITY_GATE_FAILED"),
  );

  const blockedBoard = await get(
    directorToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(blockedBoard.response.status, 200);

  const blockedAg = blockedBoard.body.assets.find(
    (asset) => asset.decision_object_key === "DO-004",
  );
  assert.ok(blockedAg);
  assert.equal(blockedAg.prioritisation.priority_rank, 1);
  assert.equal(
    blockedAg.prioritisation.portfolio_priority_index,
    alGodeyer.prioritisation.portfolio_priority_index,
  );
  assert.equal(blockedAg.governance.governance_state, "BLOCKED_CAPITAL");
  assert.equal(blockedAg.governance.capital_state, "BLOCKED");
  assert.equal(
    blockedAg.prioritisation.score_authorises_execution,
    false,
  );
  assert.equal(
    blockedAg.governance.next_controlled_action,
    "RESOLVE_CAPITAL_BLOCK",
  );

  console.log("S3 E2E: direct asset intelligence remains scope controlled");
  const direct = await get(
    directorToken,
    "/portfolio-intelligence/assets/LIC-ALGODEYER-001",
  );
  assert.equal(direct.response.status, 200);
  assert.equal(direct.decision_object_key, undefined);
  assert.equal(direct.body.decision_object_key, "DO-004");

  const partnerAssetDenied = await get(
    partnerToken,
    "/portfolio-intelligence/assets/LIC-ALGODEYER-001",
  );
  assert.equal(partnerAssetDenied.response.status, 404);

  console.log("E2E-S3-PORTFOLIO-001 PASS", {
    ppiLeader: alGodeyer.asset_id,
    voiLeader: jadib.asset_id,
    blockedCapitalRequestId: requestResult.body.capital_request_id,
  });
}

await main();
