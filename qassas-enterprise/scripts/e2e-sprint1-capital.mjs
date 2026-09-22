import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase = process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";
const runId = process.env.GITHUB_RUN_ID ?? randomUUID();

const users = {
  geo: { id: "11111111-1111-4111-8111-111111111111", username: "senior_geologist" },
  director: { id: "22222222-2222-4222-8222-222222222222", username: "exploration_director" },
  admin: { id: "33333333-3333-4333-8333-333333333333", username: "system_admin" },
  finance: { id: "55555555-5555-4555-8555-555555555555", username: "finance_reviewer" },
};

function dbConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
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
  if (!response.ok) throw new Error(`Token request failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function adminToken() {
  return formToken(`${keycloakBase}/realms/master/protocol/openid-connect/token`, {
    client_id: "admin-cli",
    grant_type: "password",
    username: process.env.KEYCLOAK_ADMIN ?? "admin",
    password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "change-me",
  });
}

async function prepareUser(token, user, password) {
  const profile = {
    senior_geologist: ["Senior","Geologist","senior.geologist@qassas.local"],
    exploration_director: ["Exploration","Director","exploration.director@qassas.local"],
    system_admin: ["System","Administrator","system.admin@qassas.local"],
    finance_reviewer: ["Finance","Reviewer","finance.reviewer@qassas.local"],
  }[user.username];

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
        firstName: profile[0],
        lastName: profile[1],
        email: profile[2],
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
      body: JSON.stringify({ type: "password", value: password, temporary: false }),
    },
  );
  assert.equal(reset.status, 204);
}

async function userToken(username, password) {
  return formToken(`${keycloakBase}/realms/${realm}/protocol/openid-connect/token`, {
    client_id: "qassas-cli",
    grant_type: "password",
    username,
    password,
  });
}

async function apiRequest(token, method, path, options = {}) {
  const headers = { authorization: `Bearer ${token}`, ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function seedGovernedPrerequisites(pool) {
  const snapshotId = `EVS-CAP-${runId}`;
  const decisionId = `DEC-CAP-${runId}`;
  const actionId = `ACT-CAP-${runId}`;
  const nbtId = `NBT-CAP-${runId}`;
  const recommendationId = `REC-CAP-${runId}`;
  const reviewId = `RRV-CAP-${runId}`;
  const rightsAssessmentId = `DCA-CAP-${runId}`;

  await pool.query(
    `INSERT INTO qassas_core.licence_register (
       licence_id, enterprise_id, licence_number, licence_type, licence_status,
       validation_status, source_instrument, security_class, created_by_user_id
     ) VALUES (
       'LIC-ABUSALAL-001','ENT-GMCO-001','SYN-AS-001','EXPLORATION','ACTIVE',
       'VALIDATED','SPRINT1_CAPITAL_E2E','C2_CONFIDENTIAL_TECHNICAL','USR-EXP-001'
     )
     ON CONFLICT (licence_id) DO UPDATE SET
       licence_status = 'ACTIVE',
       validation_status = 'VALIDATED'`
  );

  await pool.query(
    `INSERT INTO qassas_core.evidence_snapshot (
       snapshot_id, target_id, snapshot_status, created_by_user_id
     ) VALUES ($1,'TGT-AS-CORE-001','LOCKED','USR-GEO-001')`,
    [snapshotId],
  );

  await pool.query(
    `INSERT INTO qassas_core.decision_object (
       decision_id, target_id, decision_class, decision_question,
       current_gate, trigger_type, state, evidence_snapshot_id, created_by_user_id
     ) VALUES (
       $1,'TGT-AS-CORE-001','DISCOVERY_REVIEW',
       'Can controlled capital be allocated to the next information step?',
       'G6_DISCOVERY','SPRINT1_CAPITAL_E2E','DECISION_READY',$2,'USR-GEO-001'
     )`,
    [decisionId, snapshotId],
  );

  await pool.query(
    `INSERT INTO qassas_core.candidate_action (
       candidate_action_id, decision_id, action_code, title, description,
       cost_class, technical_risk, partner_dependency, created_by_user_id
     ) VALUES (
       $1,$2,'TARGETED_RECONCILIATION','3D VMS Core Reconciliation',
       'Integrate drilling, alteration and deep geophysics before resource drilling.',
       'C1','LOW',false,'USR-GEO-001'
     )`,
    [actionId, decisionId],
  );

  await pool.query(
    `INSERT INTO qassas_core.next_best_test (
       test_id, decision_id, candidate_action_id, test_type,
       uncertainty_targeted, expected_information_gain, cost_class,
       cost_range_min, cost_range_max, decision_impact,
       required_authority, status, created_by_user_id
     ) VALUES (
       $1,$2,$3,'3D_RECONCILIATION','VMS core geometry',
       'VERY_HIGH','C1',300000,500000,
       'Resolve geometry before resource-definition drilling.',
       'EXPLORATION_DIRECTOR','PROPOSED','USR-GEO-001'
     )`,
    [nbtId, decisionId, actionId],
  );

  await pool.query(
    `INSERT INTO qassas_core.recommendation (
       recommendation_id, decision_id, recommendation_version,
       evidence_snapshot_id, recommended_action_id, recommendation_text,
       rationale, confidence, recommender_type, created_by_user_id
     ) VALUES (
       $1,$2,1,$3,$4,
       'Run targeted 3D reconciliation before broad resource drilling.',
       'Highest information gain per unit of decision capital.',
       'HIGH','HUMAN','USR-GEO-001'
     )`,
    [recommendationId, decisionId, snapshotId, actionId],
  );

  await pool.query(
    `INSERT INTO qassas_core.recommendation_review (
       review_id, recommendation_id, decision_id, review_status,
       reviewer_user_id, reviewer_role_assignment_id, rationale
     ) VALUES (
       $1,$2,$3,'ACCEPTED','USR-EXP-001','RA-EXP-AS-001',
       'Independent technical review accepts the recommendation.'
     )`,
    [reviewId, recommendationId, decisionId],
  );

  await pool.query(
    `INSERT INTO qassas_core.decision_constraint_assessment (
       assessment_id, decision_id, licence_id, technical_state,
       derived_decision_state, licence_validation_status,
       partner_approval_required, partner_consent_status,
       work_commitment_risk, commitment_at_risk, licence_at_risk,
       execution_allowed, portfolio_optimisation_allowed,
       blocking_reasons, created_by_user_id
     ) VALUES (
       $1,$2,'LIC-ABUSALAL-001','DECISION_READY','DECISION_READY','VALIDATED',
       false,'NOT_REQUIRED','NONE',false,false,true,true,'[]'::jsonb,'USR-EXP-001'
     )`,
    [rightsAssessmentId, decisionId],
  );

  return { snapshotId, decisionId };
}

async function main() {
  const password = `cap-${randomBytes(18).toString("hex")}`;
  const admin = await adminToken();
  for (const user of Object.values(users)) await prepareUser(admin, user, password);

  const [geoToken, directorToken, adminUserToken, financeToken] = await Promise.all([
    userToken(users.geo.username, password),
    userToken(users.director.username, password),
    userToken(users.admin.username, password),
    userToken(users.finance.username, password),
  ]);

  const pool = new Pool(dbConfig());
  const { decisionId } = await seedGovernedPrerequisites(pool);
  const correlationId = `CORR-S1-CAPITAL-${runId}`;

  console.log("S1 CAPITAL E2E: System Admin cannot create capital request");
  const adminDenied = await apiRequest(adminUserToken, "POST", "/capital/requests", {
    headers: {
      "x-qassas-idempotency-key": `CAP-ADMIN-DENY-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      decision_id: decisionId,
      capital_type: "DECISION_CAPITAL",
      requested_amount: 500000,
      currency: "SAR",
      purpose: "Targeted 3D VMS reconciliation",
    },
  });
  assert.equal(adminDenied.response.status, 403);

  console.log("S1 CAPITAL E2E: Decision Capital request");
  const created = await apiRequest(geoToken, "POST", "/capital/requests", {
    headers: {
      "x-qassas-idempotency-key": `CAP-REQ-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      decision_id: decisionId,
      capital_type: "DECISION_CAPITAL",
      requested_amount: 500000,
      currency: "SAR",
      purpose: "Targeted 3D VMS reconciliation",
      funding_source: "PILOT_DECISION_CAPITAL",
    },
  });
  assert.ok([200,201].includes(created.response.status));
  assert.equal(created.body.state, "REQUESTED");
  const requestId = created.body.capital_request_id;

  const assessed = await apiRequest(directorToken, "POST", `/capital/requests/${requestId}/assess`, {
    headers: {
      "if-match": "1",
      "x-qassas-idempotency-key": `CAP-ASSESS-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
  });
  assert.ok([200,201].includes(assessed.response.status));
  assert.equal(assessed.body.state, "GATES_ASSESSED");
  assert.equal(assessed.body.allRequiredGatesPass, true);
  assert.equal(assessed.body.authorityGate, true);
  assert.equal(assessed.body.object_version, 2);

  console.log("S1 CAPITAL E2E: non-finance user cannot approve");
  const geoApprovalDenied = await apiRequest(geoToken, "POST", `/capital/requests/${requestId}/approve`, {
    headers: {
      "if-match": "2",
      "x-qassas-idempotency-key": `CAP-GEO-APPROVE-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: { approved_amount: 500000, rationale: "Must be denied." },
  });
  assert.equal(geoApprovalDenied.response.status, 403);

  console.log("S1 CAPITAL E2E: Finance Reviewer approves within threshold");
  const approved = await apiRequest(financeToken, "POST", `/capital/requests/${requestId}/approve`, {
    headers: {
      "if-match": "2",
      "x-qassas-idempotency-key": `CAP-APPROVE-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      approved_amount: 500000,
      rationale: "All capital release gates passed within delegated authority.",
    },
  });
  assert.ok([200,201].includes(approved.response.status));
  assert.equal(approved.body.state, "APPROVED");
  assert.equal(approved.body.object_version, 3);

  console.log("S1 CAPITAL E2E: Approved does not equal Released until explicit release");
  const beforeRelease = await apiRequest(financeToken, "GET", `/capital/requests/${requestId}`);
  assert.equal(beforeRelease.response.status, 200);
  assert.equal(beforeRelease.body.state, "APPROVED");

  const released = await apiRequest(financeToken, "POST", `/capital/requests/${requestId}/release`, {
    headers: {
      "if-match": "3",
      "x-qassas-idempotency-key": `CAP-RELEASE-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: { released_amount: 450000 },
  });
  assert.ok([200,201].includes(released.response.status));
  assert.equal(released.body.state, "RELEASED");
  assert.equal(released.body.object_version, 4);

  console.log("S1 CAPITAL E2E: threshold above delegated authority blocks assessment");
  const high = await apiRequest(geoToken, "POST", "/capital/requests", {
    headers: {
      "x-qassas-idempotency-key": `CAP-HIGH-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      decision_id: decisionId,
      capital_type: "DECISION_CAPITAL",
      requested_amount: 2500000,
      currency: "SAR",
      purpose: "Oversized decision capital envelope",
    },
  });
  const highId = high.body.capital_request_id;
  const highAssessment = await apiRequest(directorToken, "POST", `/capital/requests/${highId}/assess`, {
    headers: {
      "if-match": "1",
      "x-qassas-idempotency-key": `CAP-HIGH-ASSESS-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
  });
  assert.equal(highAssessment.body.state, "BLOCKED");
  assert.equal(highAssessment.body.authorityGate, false);
  assert.ok(highAssessment.body.blockingReasons.includes("AUTHORITY_GATE_FAILED"));

  console.log("S1 CAPITAL E2E: JV/rights regression blocks Execution Capital");
  await pool.query(
    `INSERT INTO qassas_core.decision_constraint_assessment (
       assessment_id, decision_id, licence_id, technical_state,
       derived_decision_state, licence_validation_status,
       partner_approval_required, partner_consent_status,
       work_commitment_risk, commitment_at_risk, licence_at_risk,
       execution_allowed, portfolio_optimisation_allowed,
       blocking_reasons, created_by_user_id, created_at
     ) VALUES (
       $1,$2,'LIC-ABUSALAL-001','DECISION_READY','PARTNER_APPROVAL_REQUIRED','VALIDATED',
       true,'PENDING','NONE',false,false,false,false,
       '["PARTNER_APPROVAL_REQUIRED"]'::jsonb,'USR-EXP-001',now() + interval '1 second'
     )`,
    [`DCA-CAP-BLOCK-${runId}`, decisionId],
  );

  const execReq = await apiRequest(geoToken, "POST", "/capital/requests", {
    headers: {
      "x-qassas-idempotency-key": `CAP-EXEC-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      decision_id: decisionId,
      capital_type: "EXECUTION_CAPITAL",
      requested_amount: 1000000,
      currency: "SAR",
      purpose: "Resource-definition drilling programme",
    },
  });
  const execAssessment = await apiRequest(directorToken, "POST", `/capital/requests/${execReq.body.capital_request_id}/assess`, {
    headers: {
      "if-match": "1",
      "x-qassas-idempotency-key": `CAP-EXEC-ASSESS-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
  });
  assert.equal(execAssessment.body.state, "BLOCKED");
  assert.equal(execAssessment.body.jvGate, false);
  assert.equal(execAssessment.body.programmeReadinessGate, false);
  assert.ok(execAssessment.body.blockingReasons.includes("JV_GATE_FAILED"));

  await new Promise((resolve) => setTimeout(resolve, 1200));
  const audit = await pool.query(
    `SELECT event_type
       FROM qassas_audit.audit_event
      WHERE correlation_id = $1
      ORDER BY created_at, audit_event_id`,
    [correlationId],
  );
  const events = audit.rows.map((row) => row.event_type);
  for (const required of [
    "CapitalRequested",
    "CapitalGatesAssessed",
    "CapitalApproved",
    "CapitalReleased",
    "AccessDenied",
  ]) {
    assert.ok(events.includes(required), `Missing audit event ${required}`);
  }

  const pending = await pool.query(
    `SELECT count(*)::int AS count
       FROM qassas_outbox.outbox_event
      WHERE correlation_id = $1
        AND published_at IS NULL`,
    [correlationId],
  );
  assert.equal(Number(pending.rows[0].count), 0);

  await pool.end();

  console.log("E2E-S1-CAPITAL-001 PASS", {
    decisionId,
    releasedCapitalRequestId: requestId,
    highThresholdRequestId: highId,
    blockedExecutionRequestId: execReq.body.capital_request_id,
  });
}

await main();
