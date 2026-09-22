import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase =
  process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";

const users = {
  portfolio: {
    id: "77777777-7777-4777-8777-777777777777",
    username: "portfolio_executive",
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
  const password = "s3-" + randomBytes(18).toString("hex");
  const admin = await adminToken();

  for (const user of Object.values(users)) {
    await prepareUser(admin, user, password);
  }

  const [
    portfolioToken,
    directorToken,
    adminUserToken,
    partnerToken,
  ] = await Promise.all([
    userToken(users.portfolio.username, password),
    userToken(users.director.username, password),
    userToken(users.admin.username, password),
    userToken(users.partner.username, password),
  ]);

  console.log("S3 E2E: Portfolio Executive priority queue");
  const queue = await get(
    portfolioToken,
    "/portfolio-intelligence/priority-queue",
  );
  assert.equal(queue.response.status, 200);
  assert.equal(queue.body.interface, "PORTFOLIO_PRIORITY_QUEUE");
  assert.equal(queue.body.score_authority, "ADVISORY_ONLY");
  assert.equal(queue.body.visible_asset_count, 5);
  assert.equal(queue.body.model_version, "PPI-0.1");

  const positions = queue.body.assets.map((asset) => asset.priority_position);
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    [1, 2, 3, 4, 5],
  );

  const uhm = queue.body.assets.find(
    (asset) => asset.decision_object_key === "DO-001",
  );
  assert.ok(uhm);
  assert.equal(uhm.priority_position, 1);
  assert.ok(uhm.priority.priority_index >= 79);
  assert.equal(uhm.score_can_authorise_execution, false);
  assert.equal(uhm.score_can_release_capital, false);
  assert.equal(uhm.score_can_change_gate, false);

  const jad = queue.body.assets.find(
    (asset) => asset.decision_object_key === "DO-005",
  );
  assert.ok(jad);
  assert.equal(jad.voi_position, 1);
  assert.ok(jad.value_of_information.voi_points_per_million_sar > 90);
  assert.notEqual(jad.priority_position, jad.voi_position);

  console.log("S3 E2E: Priority and VoI are distinct signals");
  assert.notEqual(
    queue.body.assets[0].decision_object_key,
    "DO-005",
  );

  console.log("S3 E2E: Portfolio Control Board");
  const boardBefore = await get(
    portfolioToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(boardBefore.response.status, 200);
  assert.equal(boardBefore.body.interface, "PORTFOLIO_CONTROL_BOARD");
  assert.equal(boardBefore.body.score_authority, "ADVISORY_ONLY");
  assert.equal(
    boardBefore.body.execution_authority,
    "GOVERNED_OUTSIDE_SCORE",
  );
  assert.equal(boardBefore.body.visible_asset_count, 5);
  assert.equal(boardBefore.body.priority_queue.length, 5);
  assert.equal(boardBefore.body.information_leverage.length, 5);
  assert.ok(boardBefore.body.change_intelligence);
  assert.ok(
    boardBefore.body.change_intelligence.visible_change_count >= 1,
  );
  assert.ok(
    Array.isArray(boardBefore.body.change_intelligence.recent_changes),
  );

  const boardCapitalBefore = JSON.stringify(
    boardBefore.body.priority_queue.map((asset) => ({
      key: asset.decision_object_key,
      gate: asset.configured_gate,
      decision_state: asset.decision_state,
      capital_state: asset.capital.state,
      released_total: asset.capital.released_total,
    })),
  );

  console.log("S3 E2E: governed Priority Assessment versioning");
  const assessmentHeaders = {
    "x-qassas-idempotency-key": "S3-JAD-ASSESSMENT-V2",
    "x-qassas-correlation-id": "CORR-S3-JAD-ASSESSMENT-V2",
  };
  const assessmentBody = {
    asset_id: "LIC-JADIB-001",
    geological_potential: 95,
    evidence_confidence: 90,
    technical_maturity: 92,
    scale_potential: 90,
    strategic_adjacency: 88,
    cost_efficiency: 95,
    data_quality: 90,
    work_commitment_risk: 5,
    partner_constraint: 5,
    next_decision_cost_sar: 300000,
    expected_information_gain_points: 28,
    rationale:
      "Synthetic Sprint 3 reassessment: higher controlled confidence while preserving governance separation.",
  };

  const createdAssessment = await post(
    portfolioToken,
    "/portfolio-intelligence/assessments",
    assessmentBody,
    assessmentHeaders,
  );
  assert.ok([200, 201].includes(createdAssessment.response.status));
  assert.equal(createdAssessment.body.asset_id, "LIC-JADIB-001");
  assert.equal(createdAssessment.body.assessment_version, 2);
  assert.equal(
    createdAssessment.body.supersedes_assessment_id,
    "PPA-JAD-001",
  );
  assert.equal(createdAssessment.body.score_authority, "ADVISORY_ONLY");
  assert.equal(createdAssessment.body.score_can_authorise_execution, false);
  assert.equal(createdAssessment.body.score_can_release_capital, false);
  assert.equal(createdAssessment.body.score_can_change_gate, false);

  const duplicateAssessment = await post(
    portfolioToken,
    "/portfolio-intelligence/assessments",
    assessmentBody,
    assessmentHeaders,
  );
  assert.ok([200, 201].includes(duplicateAssessment.response.status));
  assert.equal(
    duplicateAssessment.body.assessment_id,
    createdAssessment.body.assessment_id,
  );

  const updatedQueue = await get(
    portfolioToken,
    "/portfolio-intelligence/priority-queue",
  );
  assert.equal(updatedQueue.response.status, 200);
  const jadAfterAssessment = updatedQueue.body.assets.find(
    (item) => item.decision_object_key === "DO-005",
  );
  assert.ok(jadAfterAssessment);
  assert.equal(jadAfterAssessment.priority_position, 1);
  assert.equal(jadAfterAssessment.voi_position, 1);

  console.log("S3 E2E: Score reads do not mutate governed state");
  const queueAgain = await get(
    portfolioToken,
    "/portfolio-intelligence/priority-queue",
  );
  assert.equal(queueAgain.response.status, 200);

  const boardAfter = await get(
    portfolioToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(boardAfter.response.status, 200);

  const boardCapitalAfter = JSON.stringify(
    boardAfter.body.priority_queue.map((asset) => ({
      key: asset.decision_object_key,
      gate: asset.configured_gate,
      decision_state: asset.decision_state,
      capital_state: asset.capital.state,
      released_total: asset.capital.released_total,
    })),
  );
  assert.equal(boardCapitalAfter, boardCapitalBefore);

  console.log("S3 E2E: Exploration Director may see priority queue, not executive board");
  const directorQueue = await get(
    directorToken,
    "/portfolio-intelligence/priority-queue",
  );
  assert.equal(directorQueue.response.status, 200);
  assert.equal(directorQueue.body.visible_asset_count, 5);

  const directorBoard = await get(
    directorToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(directorBoard.response.status, 404);

  console.log("S3 E2E: Partner and System Admin anti-inference");
  for (const token of [partnerToken, adminUserToken]) {
    const deniedQueue = await get(
      token,
      "/portfolio-intelligence/priority-queue",
    );
    assert.equal(deniedQueue.response.status, 404);

    const deniedBoard = await get(
      token,
      "/portfolio-intelligence/control-board",
    );
    assert.equal(deniedBoard.response.status, 404);
  }

  console.log("S3 E2E: Asset intelligence dimensions");
  const asset = await get(
    portfolioToken,
    "/portfolio-intelligence/assets/LIC-JADIB-001",
  );
  assert.equal(asset.response.status, 200);
  assert.equal(asset.body.decision_object_key, "DO-005");
  assert.equal(asset.body.dimensions.technical_maturity, 30);
  assert.equal(asset.body.dimensions.cost_efficiency, 90);
  assert.equal(asset.body.voi_position, 1);

  console.log("S3 E2E: Recommendation Delta change intelligence");
  const changeFeed = await get(
    portfolioToken,
    "/portfolio-intelligence/change-feed",
  );
  assert.equal(changeFeed.response.status, 200);
  assert.equal(changeFeed.body.interface, "PORTFOLIO_CHANGE_FEED");
  assert.ok(changeFeed.body.visible_change_count >= 1);
  for (const change of changeFeed.body.changes) {
    assert.equal(change.change_can_approve_decision, false);
    assert.equal(change.change_can_release_capital, false);
    assert.equal(change.change_can_change_gate, false);
    assert.ok(change.previous.recommendation_id);
    assert.ok(change.next.recommendation_id);
  }

  const directorChanges = await get(
    directorToken,
    "/portfolio-intelligence/change-feed",
  );
  assert.equal(directorChanges.response.status, 200);

  for (const token of [partnerToken, adminUserToken]) {
    const deniedChanges = await get(
      token,
      "/portfolio-intelligence/change-feed",
    );
    assert.equal(deniedChanges.response.status, 404);
  }

  console.log("S3 E2E: governed Portfolio Reassessment Snapshot");
  const beforeSnapshotBoard = await get(
    portfolioToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(beforeSnapshotBoard.response.status, 200);
  const governedBefore = JSON.stringify(
    beforeSnapshotBoard.body.priority_queue.map((item) => ({
      key: item.decision_object_key,
      gate: item.configured_gate,
      decision_state: item.decision_state,
      capital_state: item.capital.state,
      released_total: item.capital.released_total,
    })),
  );

  const snapshotHeaders = {
    "x-qassas-idempotency-key": "S3-REASSESSMENT-SNAPSHOT-001",
    "x-qassas-correlation-id": "CORR-S3-REASSESSMENT-001",
  };
  const snapshotBody = {
    trigger_type: "SPRINT3_CONTROL_BOARD_REASSESSMENT",
    source_event_refs: changeFeed.body.changes
      .slice(0, 3)
      .map((change) => change.delta_id),
  };

  const createdSnapshot = await post(
    portfolioToken,
    "/portfolio-intelligence/reassessment-snapshots",
    snapshotBody,
    snapshotHeaders,
  );
  assert.ok([200, 201].includes(createdSnapshot.response.status));
  assert.equal(createdSnapshot.body.asset_count, 5);
  assert.equal(createdSnapshot.body.snapshot_can_authorise_execution, false);
  assert.equal(createdSnapshot.body.snapshot_can_release_capital, false);
  assert.equal(createdSnapshot.body.snapshot_can_change_gate, false);
  assert.ok(createdSnapshot.body.snapshot_id);
  assert.ok(createdSnapshot.body.portfolio_state_hash);

  const duplicateSnapshot = await post(
    portfolioToken,
    "/portfolio-intelligence/reassessment-snapshots",
    snapshotBody,
    snapshotHeaders,
  );
  assert.ok([200, 201].includes(duplicateSnapshot.response.status));
  assert.equal(
    duplicateSnapshot.body.snapshot_id,
    createdSnapshot.body.snapshot_id,
  );

  const snapshotList = await get(
    portfolioToken,
    "/portfolio-intelligence/reassessment-snapshots",
  );
  assert.equal(snapshotList.response.status, 200);
  assert.ok(snapshotList.body.snapshot_count >= 1);
  assert.equal(snapshotList.body.snapshots[0].immutable, true);

  const snapshotDetail = await get(
    portfolioToken,
    "/portfolio-intelligence/reassessment-snapshots/" +
      createdSnapshot.body.snapshot_id,
  );
  assert.equal(snapshotDetail.response.status, 200);
  assert.equal(snapshotDetail.body.immutable, true);
  assert.equal(
    snapshotDetail.body.portfolio_state_hash,
    createdSnapshot.body.portfolio_state_hash,
  );
  assert.equal(
    snapshotDetail.body.snapshot.portfolio_control_board.visible_asset_count,
    5,
  );

  const afterSnapshotBoard = await get(
    portfolioToken,
    "/portfolio-intelligence/control-board",
  );
  assert.equal(afterSnapshotBoard.response.status, 200);
  const governedAfter = JSON.stringify(
    afterSnapshotBoard.body.priority_queue.map((item) => ({
      key: item.decision_object_key,
      gate: item.configured_gate,
      decision_state: item.decision_state,
      capital_state: item.capital.state,
      released_total: item.capital.released_total,
    })),
  );
  assert.equal(governedAfter, governedBefore);

  for (const token of [partnerToken, adminUserToken, directorToken]) {
    const deniedSnapshots = await get(
      token,
      "/portfolio-intelligence/reassessment-snapshots",
    );
    assert.equal(deniedSnapshots.response.status, 404);
  }

  console.log("E2E-S3-PORTFOLIO-001 PASS");
}

await main();
