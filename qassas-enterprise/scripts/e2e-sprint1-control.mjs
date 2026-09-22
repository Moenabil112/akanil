import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase = process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";
const runId = process.env.GITHUB_RUN_ID ?? randomUUID();

const users = {
  admin: {
    id: "33333333-3333-4333-8333-333333333333",
    username: "system_admin",
    profile: ["System","Administrator","system.admin@qassas.local"],
  },
  partner: {
    id: "44444444-4444-4444-8444-444444444444",
    username: "partner_user",
    profile: ["Pilot","Partner","partner.user@qassas.local"],
  },
  finance: {
    id: "55555555-5555-4555-8555-555555555555",
    username: "finance_reviewer",
    profile: ["Finance","Reviewer","finance.reviewer@qassas.local"],
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
    throw new Error(`Token request failed: ${JSON.stringify(body)}`);
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

async function prepareUser(token, user, password) {
  const [firstName,lastName,email] = user.profile;

  const update = await fetch(
    `${keycloakBase}/admin/realms/${realm}/users/${user.id}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: user.username,
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        firstName,
        lastName,
        email,
      }),
    },
  );
  assert.equal(update.status, 204);

  const reset = await fetch(
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
  assert.equal(reset.status, 204);
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

async function get(token, path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function main() {
  const password = `ctrl-${randomBytes(18).toString("hex")}`;
  const admin = await adminToken();
  for (const user of Object.values(users)) {
    await prepareUser(admin, user, password);
  }

  const [financeToken, adminUserToken, partnerToken] = await Promise.all([
    userToken(users.finance.username, password),
    userToken(users.admin.username, password),
    userToken(users.partner.username, password),
  ]);

  console.log("S1 CONTROL E2E: Finance Reviewer reads governed asset projection");
  const asset = await get(
    financeToken,
    "/portfolio-control/assets/LIC-ABUSALAL-001",
  );
  assert.equal(asset.response.status, 200);
  assert.equal(asset.body.asset_id, "LIC-ABUSALAL-001");
  assert.ok(asset.body.decision_count >= 1);
  assert.ok(Array.isArray(asset.body.decisions));

  const fundedHistory = asset.body.decisions.find(
    (row) => Number(row.capital.released_capital_total ?? 0) > 0,
  );
  assert.ok(fundedHistory, "Expected released capital history in control view");
  assert.ok(fundedHistory.capital.release_count >= 1);

  const blocked = asset.body.decisions.find(
    (row) =>
      row.portfolio_attention_state === "BLOCKED" &&
      (
        row.capital.state === "BLOCKED" ||
        row.rights.partner_approval_required === true
      ),
  );
  assert.ok(blocked, "Expected a blocked decision/control state");

  const reviewedRecommendation = asset.body.decisions.find(
    (row) => row.recommendation.review_status === "ACCEPTED",
  );
  assert.ok(
    reviewedRecommendation,
    "Expected independently reviewed recommendation in control projection",
  );

  assert.ok(
    asset.body.blocked_count >= 1,
    "Asset summary must expose blocking attention count",
  );

  console.log("S1 CONTROL E2E: System Admin cannot infer portfolio business data");
  const adminDenied = await get(
    adminUserToken,
    "/portfolio-control/assets/LIC-ABUSALAL-001",
  );
  assert.equal(adminDenied.response.status, 404);

  console.log("S1 CONTROL E2E: unrelated Partner cannot infer portfolio business data");
  const partnerDenied = await get(
    partnerToken,
    "/portfolio-control/assets/LIC-ABUSALAL-001",
  );
  assert.equal(partnerDenied.response.status, 404);

  console.log("S1 CONTROL E2E: decision projection resolves same governed sources");
  const decision = await get(
    financeToken,
    `/portfolio-control/decisions/${fundedHistory.decision_id}`,
  );
  assert.equal(decision.response.status, 200);
  assert.equal(decision.body.decision_id, fundedHistory.decision_id);
  assert.equal(decision.body.asset_id, "LIC-ABUSALAL-001");
  assert.equal(
    Number(decision.body.capital.released_capital_total),
    Number(fundedHistory.capital.released_capital_total),
  );

  console.log("E2E-S1-CONTROL-001 PASS", {
    decisionCount: asset.body.decision_count,
    blockedCount: asset.body.blocked_count,
    fundedDecisionId: fundedHistory.decision_id,
    fundedTotal: fundedHistory.capital.released_capital_total,
    blockedDecisionId: blocked.decision_id,
  });
}

await main();
