import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { Client as TemporalClient, Connection } from "@temporalio/client";

const { Pool } = pg;

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase =
  process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";
const temporalAddress =
  process.env.TEMPORAL_ADDRESS ?? "127.0.0.1:7233";
const temporalNamespace =
  process.env.TEMPORAL_NAMESPACE ?? "qassas-pilot";
const runId = process.env.GITHUB_RUN_ID ?? randomUUID();

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

async function waitUntil(label, fn, timeoutMs = 90000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError}` : ""}`,
  );
}

async function formToken(url, values) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Token request failed ${response.status}: ${JSON.stringify(body)}`);
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

async function setPassword(token, userId, password) {
  const response = await fetch(
    `${keycloakBase}/admin/realms/${realm}/users/${userId}/reset-password`,
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
  assert.equal(response.status, 204, `password reset failed for ${userId}`);
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

async function apiRequest(token, method, path, options = {}) {
  const headers = {
    authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
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
  console.log("E2E-BF01-001: waiting for services");

  await waitUntil("Keycloak", async () => {
    const r = await fetch(
      `${keycloakBase}/realms/${realm}/.well-known/openid-configuration`,
    );
    return r.ok;
  });

  await waitUntil("QASSAS API", async () => {
    const r = await fetch(`${apiBase}/health/live`);
    return r.ok;
  });

  const password = `ci-${randomBytes(18).toString("hex")}`;
  const admin = await adminToken();
  for (const user of Object.values(users)) {
    await setPassword(admin, user.id, password);
  }

  const [geoToken, directorToken, adminUserToken, partnerToken] =
    await Promise.all([
      userToken(users.geo.username, password),
      userToken(users.director.username, password),
      userToken(users.admin.username, password),
      userToken(users.partner.username, password),
    ]);

  console.log("E2E: verifying object-scope authorization");

  const geoTarget = await apiRequest(
    geoToken,
    "GET",
    "/targets/TGT-AS-CORE-001",
  );
  assert.equal(geoTarget.response.status, 200);
  assert.equal(geoTarget.body.asset_id, "LIC-ABUSALAL-001");

  const partnerTarget = await apiRequest(
    partnerToken,
    "GET",
    "/targets/TGT-AS-CORE-001",
  );
  assert.equal(partnerTarget.response.status, 404);

  const adminTarget = await apiRequest(
    adminUserToken,
    "GET",
    "/targets/TGT-AS-CORE-001",
  );
  assert.equal(adminTarget.response.status, 404);

  const correlationId = `CORR-E2E-${runId}`;
  const openKey = `IDEM-E2E-OPEN-${runId}`;
  const openBody = {
    target_id: "TGT-AS-CORE-001",
    decision_class: "DISCOVERY_REVIEW",
    decision_question:
      "Does current evidence justify progression toward resource-definition drilling?",
    trigger_type: "SPRINT0_E2E",
    current_gate: "G6_DISCOVERY",
  };

  console.log("E2E: opening governed DecisionObject");
  const opened = await apiRequest(geoToken, "POST", "/decisions", {
    headers: {
      "x-qassas-idempotency-key": openKey,
      "x-qassas-correlation-id": correlationId,
    },
    body: openBody,
  });
  assert.ok([200, 201].includes(opened.response.status));
  assert.equal(opened.body.state, "CREATED");
  assert.equal(opened.body.object_version, 1);
  const decisionId = opened.body.decision_id;
  assert.ok(decisionId);

  const duplicateOpen = await apiRequest(geoToken, "POST", "/decisions", {
    headers: {
      "x-qassas-idempotency-key": openKey,
      "x-qassas-correlation-id": correlationId,
    },
    body: openBody,
  });
  assert.ok([200, 201].includes(duplicateOpen.response.status));
  assert.equal(duplicateOpen.body.decision_id, decisionId);

  console.log("E2E: requesting HumanReview / Temporal workflow");
  const review = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/reviews`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `IDEM-E2E-REVIEW-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
    },
  );
  assert.ok([200, 201].includes(review.response.status));
  assert.equal(review.body.state, "HUMAN_REVIEW_REQUIRED");
  assert.equal(review.body.object_version, 2);
  assert.ok(review.body.workflow_id);

  console.log("E2E: proving segregation of duties");
  const selfApproval = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/approve`,
    {
      headers: {
        "if-match": "2",
        "x-qassas-idempotency-key": `IDEM-E2E-SELF-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: { rationale: "Creator must not approve their own material decision." },
    },
  );
  assert.equal(selfApproval.response.status, 403);

  console.log("E2E: approving through Exploration Director");
  const approved = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/approve`,
    {
      headers: {
        "if-match": "2",
        "x-qassas-idempotency-key": `IDEM-E2E-APPROVE-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        rationale: "Controlled Sprint 0 approval after independent human review.",
      },
    },
  );
  assert.ok([200, 201].includes(approved.response.status));
  assert.equal(approved.body.state, "APPROVED");
  assert.equal(approved.body.object_version, 3);

  console.log("E2E: checking optimistic concurrency");
  const staleApproval = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/approve`,
    {
      headers: {
        "if-match": "2",
        "x-qassas-idempotency-key": `IDEM-E2E-STALE-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: { rationale: "This stale approval must fail." },
    },
  );
  assert.equal(staleApproval.response.status, 409);

  const pool = new Pool(dbConfig());
  try {
    await waitUntil("published outbox/read model", async () => {
      const readModel = await pool.query(
        `SELECT state, object_version
           FROM qassas_core.decision_read_model
          WHERE decision_id = $1`,
        [decisionId],
      );
      if (
        readModel.rows[0]?.state !== "APPROVED" ||
        Number(readModel.rows[0]?.object_version) !== 3
      ) {
        return false;
      }

      const pending = await pool.query(
        `SELECT count(*)::int AS count
           FROM qassas_outbox.outbox_event
          WHERE aggregate_id = $1
            AND published_at IS NULL`,
        [decisionId],
      );
      return Number(pending.rows[0]?.count ?? 0) === 0;
    });

    const delivery = await pool.query(
      `SELECT count(*)::int AS count
         FROM qassas_outbox.consumer_delivery d
         JOIN qassas_outbox.outbox_event e
           ON e.outbox_event_id = d.outbox_event_id
        WHERE e.aggregate_id = $1
          AND d.consumer_name = 'decision-read-model'`,
      [decisionId],
    );
    assert.ok(Number(delivery.rows[0]?.count ?? 0) >= 4);

    const hashes = await pool.query(
      `SELECT payload_hash, previous_event_hash
         FROM qassas_audit.audit_event
        WHERE object_type = 'DecisionObject'
          AND object_id = $1
        ORDER BY created_at, audit_event_id`,
      [decisionId],
    );
    assert.ok(hashes.rows.length >= 4);
    assert.equal(hashes.rows[0].previous_event_hash, null);
    for (let i = 1; i < hashes.rows.length; i += 1) {
      assert.equal(
        hashes.rows[i].previous_event_hash,
        hashes.rows[i - 1].payload_hash,
      );
    }
  } finally {
    await pool.end();
  }

  console.log("E2E: reconstructing audit history");
  const audit = await apiRequest(
    directorToken,
    "GET",
    `/audit/objects/${decisionId}`,
  );
  assert.equal(audit.response.status, 200);
  const eventTypes = audit.body.map((event) => event.event_type);
  assert.deepEqual(eventTypes.slice(0, 4), [
    "DecisionOpened",
    "HumanReviewRequested",
    "AccessDenied",
    "DecisionApproved",
  ]);

  console.log("E2E: verifying Temporal outcome");
  const connection = await Connection.connect({ address: temporalAddress });
  try {
    const temporal = new TemporalClient({
      connection,
      namespace: temporalNamespace,
    });
    const handle = temporal.workflow.getHandle(review.body.workflow_id);
    const outcome = await Promise.race([
      handle.result(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Temporal result timeout")),
          30000,
        ),
      ),
    ]);
    assert.equal(outcome.status, "APPROVED");
    assert.equal(outcome.decisionId, decisionId);
    assert.equal(outcome.reviewId, review.body.review_id);
  } finally {
    await connection.close();
  }

  console.log("E2E-BF01-001 PASS", {
    decisionId,
    reviewId: review.body.review_id,
    workflowId: review.body.workflow_id,
  });
}

await main();
