import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

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
  finance: {
    id: "55555555-5555-4555-8555-555555555555",
    username: "finance_reviewer",
  },
  executive: {
    id: "77777777-7777-4777-8777-777777777777",
    username: "portfolio_executive",
  },
};

function dbConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.QASSAS_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.QASSAS_DB_PORT ?? 5432),
    database: process.env.QASSAS_DB_NAME ?? "qassas",
    user: process.env.QASSAS_DB_USER ?? "qassas",
    password: process.env.QASSAS_DB_PASSWORD ?? "",
  };
}

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

  const [
    geoToken,
    directorToken,
    adminUserToken,
    partnerToken,
    financeToken,
    executiveToken,
  ] = await Promise.all([
    userToken(users.geo.username, password),
    userToken(users.director.username, password),
    userToken(users.admin.username, password),
    userToken(users.partner.username, password),
    userToken(users.finance.username, password),
    userToken(users.executive.username, password),
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
    assert.equal(asset.prioritisation.score_authorises_execution, false);
    assert.ok(
      asset.prioritisation.portfolio_priority_index >= 0 &&
        asset.prioritisation.portfolio_priority_index <= 100,
    );
    assert.ok(asset.prioritisation.voi_points_per_million_sar >= 0);

    assert.deepEqual(Object.keys(asset.assessment.dimensions).sort(), [
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
  assert.notEqual(alGodeyer.asset_id, jadib.asset_id);

  console.log("S3 E2E: Jadib high VoI does not make it Drill Ready");
  assert.equal(jadib.configured_gate, "G2_TARGET_GENERATED");
  assert.equal(jadib.decision_gate, "G2_TARGET_GENERATED");
  assert.notEqual(jadib.decision_gate, "G5_DRILL_READY");

  console.log("S3 E2E: role-specific portfolio intelligence");
  const executiveBoard = await get(
    executiveToken,
    "/portfolio-intelligence/board",
  );
  assert.equal(executiveBoard.response.status, 200);
  assert.equal(executiveBoard.body.interface, "BOARD");
  assert.equal(executiveBoard.body.visible_asset_count, 5);

  const exploration = await get(
    directorToken,
    "/portfolio-intelligence/exploration",
  );
  assert.equal(exploration.response.status, 200);
  assert.equal(exploration.body.interface, "EXPLORATION");
  assert.equal(exploration.body.visible_asset_count, 5);
  assert.ok(exploration.body.assets[0].assessment.dimensions);

  const finance = await get(
    financeToken,
    "/portfolio-intelligence/finance",
  );
  assert.equal(finance.response.status, 200);
  assert.equal(finance.body.interface, "FINANCE_INTELLIGENCE");
  assert.equal(finance.body.visible_asset_count, 5);
  for (const asset of finance.body.assets) {
    assert.equal(Object.hasOwn(asset, "assessment"), false);
    assert.equal(Object.hasOwn(asset, "dimensions"), false);
    assert.equal(Object.hasOwn(asset, "rationale"), false);
    assert.equal(Object.hasOwn(asset, "cost_to_next_decision_sar"), true);
    assert.equal(Object.hasOwn(asset, "voi_points_per_million_sar"), true);
    assert.equal(asset.score_authorises_execution, false);
  }

  for (const [token, label] of [
    [partnerToken, "Partner"],
    [adminUserToken, "System Admin"],
  ]) {
    for (const path of [
      "/portfolio-intelligence/control-board",
      "/portfolio-intelligence/board",
      "/portfolio-intelligence/exploration",
      "/portfolio-intelligence/finance",
    ]) {
      const denied = await get(token, path);
      assert.equal(
        denied.response.status,
        404,
        label + " must not receive " + path,
      );
    }
  }

  console.log("S3 E2E: high PPI cannot bypass governed Capital controls");
  assert.ok(alGodeyer.decision_id);
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
  assert.ok(assessed.body.blockingReasons.includes("AUTHORITY_GATE_FAILED"));

  const blockedBoard = await get(
    directorToken,
    "/portfolio-intelligence/control-board",
  );
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
  assert.equal(blockedAg.prioritisation.score_authorises_execution, false);
  assert.equal(
    blockedAg.governance.next_controlled_action,
    "RESOLVE_CAPITAL_BLOCK",
  );

  console.log("S3 E2E: RecommendationDelta drives immutable reassessment");
  const pool = new Pool(dbConfig());
  try {
    const deltaResult = await pool.query(
      `SELECT rd.delta_id, rd.decision_id
         FROM qassas_core.recommendation_delta rd
         JOIN qassas_core.decision_object d
           ON d.decision_id = rd.decision_id
        WHERE d.target_id = 'TGT-AS-CORE-001'
        ORDER BY rd.created_at DESC, rd.delta_id DESC
        LIMIT 1`,
    );
    assert.equal(deltaResult.rowCount, 1);
    const delta = deltaResult.rows[0];

    const reassessmentBody = {
      target_id: "TGT-AS-CORE-001",
      decision_id: delta.decision_id,
      recommendation_delta_id: delta.delta_id,
      trigger_type: "RECOMMENDATION_DELTA",
      rationale:
        "Sprint 3 synthetic reassessment after a material RecommendationDelta.",
      dimensions: {
        geological_potential: 90,
        evidence_confidence: 82,
        technical_maturity: 72,
        scale_potential: 88,
        strategic_adjacency: 78,
        cost_to_next_decision: 50,
        work_commitment_risk: 20,
        partner_constraint: 10,
        data_quality: 85,
      },
      cost_to_next_decision_sar: 1000000,
      expected_information_gain: 80,
    };

    const reassessed = await post(
      directorToken,
      "/portfolio-intelligence/target-assessments",
      reassessmentBody,
      {
        "x-qassas-idempotency-key": "S3-AS-REASSESS-" + runId,
        "x-qassas-correlation-id": "CORR-S3-AS-REASSESS-" + runId,
      },
    );
    assert.ok([200, 201].includes(reassessed.response.status));
    assert.equal(reassessed.body.assessment_version, 2);
    assert.equal(reassessed.body.score_authorises_execution, false);
    assert.equal(reassessed.body.automatic_gate_consequence, false);
    assert.equal(reassessed.body.automatic_capital_consequence, false);
    assert.ok(reassessed.body.reassessment);
    assert.notEqual(reassessed.body.reassessment.ppi_delta, 0);
    assert.equal(
      reassessed.body.reassessment.new_assessment_id,
      reassessed.body.assessment_id,
    );

    const duplicate = await post(
      directorToken,
      "/portfolio-intelligence/target-assessments",
      reassessmentBody,
      {
        "x-qassas-idempotency-key": "S3-AS-REASSESS-" + runId,
        "x-qassas-correlation-id": "CORR-S3-AS-REASSESS-" + runId,
      },
    );
    assert.ok([200, 201].includes(duplicate.response.status));
    assert.equal(duplicate.body.assessment_id, reassessed.body.assessment_id);

    const history = await get(
      directorToken,
      "/portfolio-intelligence/reassessments/assets/LIC-ABUSALAL-001",
    );
    assert.equal(history.response.status, 200);
    assert.ok(history.body.reassessments.length >= 1);
    assert.equal(
      history.body.reassessments[0].recommendation_delta_id,
      delta.delta_id,
    );

    let immutable = false;
    try {
      await pool.query(
        `UPDATE qassas_core.target_assessment
            SET data_quality = 1
          WHERE assessment_id = $1`,
        [reassessed.body.assessment_id],
      );
    } catch {
      immutable = true;
    }
    assert.equal(immutable, true, "TargetAssessment must be immutable");
  } finally {
    await pool.end();
  }

  console.log("S3 E2E: reassessment does not change lifecycle Gate");
  const postReassessmentBoard = await get(
    directorToken,
    "/portfolio-intelligence/control-board",
  );
  const abuSalal = postReassessmentBoard.body.assets.find(
    (asset) => asset.decision_object_key === "DO-002",
  );
  assert.ok(abuSalal);
  assert.equal(abuSalal.configured_gate, "G6_DISCOVERY");
  assert.equal(abuSalal.decision_gate, "G6_DISCOVERY");
  assert.equal(abuSalal.assessment.assessment_version, 2);

  console.log("S3 E2E: non-authoritative portfolio scenario");
  const scenario = await post(
    executiveToken,
    "/portfolio-intelligence/scenarios",
    {
      scenario_name: "Evidence-and-cost sensitivity",
      purpose:
        "Compare portfolio ordering under greater evidence-confidence and decision-cost emphasis.",
      weights: {
        geological_potential: 0.12,
        evidence_confidence: 0.20,
        technical_maturity: 0.12,
        scale_potential: 0.08,
        strategic_adjacency: 0.08,
        cost_to_next_decision: 0.14,
        work_commitment_risk: 0.08,
        partner_constraint: 0.08,
        data_quality: 0.10,
      },
    },
    {
      "x-qassas-idempotency-key": "S3-SCENARIO-" + runId,
      "x-qassas-correlation-id": "CORR-S3-SCENARIO-" + runId,
    },
  );
  assert.ok([200, 201].includes(scenario.response.status));
  assert.equal(scenario.body.authoritative, false);
  assert.equal(scenario.body.automatic_execution_consequence, false);
  assert.equal(scenario.body.automatic_gate_consequence, false);
  assert.equal(scenario.body.automatic_capital_consequence, false);
  assert.equal(scenario.body.assets.length, 5);
  assert.ok(
    scenario.body.assets.some(
      (asset) => Math.abs(asset.ppi_delta ?? 0) > 0,
    ),
  );
  for (const asset of scenario.body.assets) {
    assert.equal(asset.score_authorises_execution, false);
  }

  console.log("S3 E2E: direct asset intelligence remains scope controlled");
  const direct = await get(
    directorToken,
    "/portfolio-intelligence/assets/LIC-ALGODEYER-001",
  );
  assert.equal(direct.response.status, 200);
  assert.equal(direct.body.decision_object_key, "DO-004");

  const partnerAssetDenied = await get(
    partnerToken,
    "/portfolio-intelligence/assets/LIC-ALGODEYER-001",
  );
  assert.equal(partnerAssetDenied.response.status, 404);

  console.log("E2E-S3-PORTFOLIO-001 PASS", {
    initialPpiLeader: alGodeyer.asset_id,
    initialVoiLeader: jadib.asset_id,
    blockedCapitalRequestId: requestResult.body.capital_request_id,
    scenarioId: scenario.body.scenario_id,
  });
}

await main();
