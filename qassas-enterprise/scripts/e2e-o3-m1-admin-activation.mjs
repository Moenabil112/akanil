import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase = process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";

const users = {
  systemAdmin: {
    id: "33333333-3333-4333-8333-333333333333",
    username: "system_admin",
  },
  candidate: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    username: "atlas_activation_candidate_ci",
    email: "atlas.activation.ci@qassas.local",
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

async function keycloakAdminToken() {
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

async function apiRequest(token, path, options = {}) {
  const response = await fetchWithTimeout(`${apiBase}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
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
  const kcAdmin = await keycloakAdminToken();

  await setPassword(kcAdmin, users.systemAdmin, password);
  await setPassword(kcAdmin, users.candidate, password);

  const [systemAdminToken, candidateToken] = await Promise.all([
    userToken(users.systemAdmin.username, password),
    userToken(users.candidate.username, password),
  ]);

  const before = await apiRequest(candidateToken, "/institutional-portfolios");
  assert.equal(
    before.response.status,
    401,
    "Keycloak identity must not enter QASSAS before activation",
  );

  const issued = await apiRequest(
    systemAdminToken,
    "/institutional-onboarding/institutions/INST-ATLAS-GOLDEN-KSA/admin-activation-tickets",
    {
      method: "POST",
      headers: { "x-qassas-correlation-id": "CORR-M1-ISSUE-001" },
      body: JSON.stringify({
        expected_email: users.candidate.email,
        expires_in_hours: 24,
      }),
    },
  );
  assert.equal(issued.response.status, 201);
  assert.equal(issued.body.ticket_status, "PENDING");
  assert.equal(issued.body.expected_email, users.candidate.email);
  assert.equal(issued.body.activation_code_display_once, true);
  assert.ok(issued.body.activation_code);
  assert.ok(issued.body.ticket_id);

  const wrongCode = await apiRequest(
    candidateToken,
    `/institutional-onboarding/admin-activation-tickets/${encodeURIComponent(issued.body.ticket_id)}/claim`,
    {
      method: "POST",
      headers: { "x-qassas-correlation-id": "CORR-M1-WRONG-001" },
      body: JSON.stringify({ activation_code: "not-the-real-code" }),
    },
  );
  assert.equal(
    wrongCode.response.status,
    403,
    "A verified identity with the wrong one-time secret must be rejected",
  );

  const claimed = await apiRequest(
    candidateToken,
    `/institutional-onboarding/admin-activation-tickets/${encodeURIComponent(issued.body.ticket_id)}/claim`,
    {
      method: "POST",
      headers: { "x-qassas-correlation-id": "CORR-M1-CLAIM-001" },
      body: JSON.stringify({ activation_code: issued.body.activation_code }),
    },
  );
  assert.equal(claimed.response.status, 201);
  assert.equal(claimed.body.institution_id, "INST-ATLAS-GOLDEN-KSA");
  assert.equal(claimed.body.iam_binding_status, "BOUND");
  assert.equal(claimed.body.account_status, "ACTIVE");
  assert.equal(claimed.body.login_enabled, true);
  assert.equal(claimed.body.ticket_status, "CLAIMED");

  const replay = await apiRequest(
    candidateToken,
    `/institutional-onboarding/admin-activation-tickets/${encodeURIComponent(issued.body.ticket_id)}/claim`,
    {
      method: "POST",
      body: JSON.stringify({ activation_code: issued.body.activation_code }),
    },
  );
  assert.equal(
    replay.response.status,
    400,
    "Activation ticket must be single-use",
  );

  const after = await apiRequest(candidateToken, "/institutional-portfolios");
  assert.equal(after.response.status, 200);
  assert.equal(after.body.institution_count, 1);
  assert.deepEqual(
    after.body.portfolios.map((portfolio) => portfolio.portfolio_id),
    ["PORT-ATLAS-GOLDEN-KSA"],
  );
  assert.equal(
    after.body.portfolios[0].institutional_account.login_enabled,
    true,
  );

  const status = await apiRequest(
    systemAdminToken,
    "/institutional-onboarding/institutions/INST-ATLAS-GOLDEN-KSA/admin-activation-tickets/latest",
  );
  assert.equal(status.response.status, 200);
  assert.equal(status.body.account.login_enabled, true);
  assert.equal(status.body.account.iam_binding_status, "BOUND");
  assert.equal(status.body.latest_ticket.status, "CLAIMED");
  assert.equal(status.body.latest_ticket.expected_email, users.candidate.email);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        pre_activation_qassas_access: "DENIED",
        ticket_issue: "PASS",
        wrong_secret_rejected: true,
        verified_keycloak_self_claim: "PASS",
        replay_rejected: true,
        post_activation_visible_portfolios: 1,
        primary_admin_account_status: "ACTIVE",
        primary_admin_iam_binding_status: "BOUND",
      },
      null,
      2,
    ),
  );
}

await main();
