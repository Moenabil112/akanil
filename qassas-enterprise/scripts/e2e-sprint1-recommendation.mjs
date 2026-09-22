import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const apiBase = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const keycloakBase =
  process.env.KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8080";
const realm = "qassas-pilot";
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
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.QASSAS_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.QASSAS_DB_PORT ?? 5432),
    database: process.env.QASSAS_DB_NAME ?? "qassas",
    user: process.env.QASSAS_DB_USER ?? "qassas",
    password: process.env.QASSAS_DB_PASSWORD ?? "",
  };
}

async function waitUntil(label, fn, timeoutMs = 90000, intervalMs = 500) {
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

async function prepareUser(token, user, password) {
  const profile = {
    senior_geologist: {
      firstName: "Senior",
      lastName: "Geologist",
      email: "senior.geologist@qassas.local",
    },
    exploration_director: {
      firstName: "Exploration",
      lastName: "Director",
      email: "exploration.director@qassas.local",
    },
    system_admin: {
      firstName: "System",
      lastName: "Administrator",
      email: "system.admin@qassas.local",
    },
    partner_user: {
      firstName: "Pilot",
      lastName: "Partner",
      email: "partner.user@qassas.local",
    },
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
        ...profile,
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
  console.log("E2E-S1-RECOMMENDATION-001: waiting for services");

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

  const password = `s1rec-${randomBytes(18).toString("hex")}`;
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

  const pool = new Pool(dbConfig());
  let decisionId;
  let snapshotId;
  let triggerEvidenceId;
  let baselineDecisionVersion;

  try {
    const source = await pool.query(
      `SELECT d.decision_id, d.evidence_snapshot_id, d.object_version,
              si.evidence_id
         FROM qassas_core.decision_object d
         JOIN qassas_core.decision_evidence_binding b
           ON b.decision_id = d.decision_id
         JOIN qassas_core.evidence_snapshot_item si
           ON si.snapshot_id = d.evidence_snapshot_id
        WHERE b.derived_state = 'DECISION_READY'
        ORDER BY b.bound_at DESC, si.evidence_id
        LIMIT 1`,
    );
    assert.ok(source.rows[0], "Evidence E2E must create a DECISION_READY Decision");
    decisionId = source.rows[0].decision_id;
    snapshotId = source.rows[0].evidence_snapshot_id;
    triggerEvidenceId = source.rows[0].evidence_id;
    baselineDecisionVersion = Number(source.rows[0].object_version);
  } finally {
    await pool.end();
  }

  assert.equal(baselineDecisionVersion, 2);
  const correlationId = `CORR-S1-REC-${runId}`;

  console.log("S1 REC E2E: proving Recommendation authorization boundaries");
  const deniedAction = {
    action_code: "DENIED_ACTION",
    title: "Denied action",
    description: "Must never be created by a non-business authority.",
    cost_class: "C1",
  };

  const adminDenied = await apiRequest(
    adminUserToken,
    "POST",
    `/decisions/${decisionId}/candidate-actions`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-ADMIN-DENY-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: deniedAction,
    },
  );
  assert.equal(adminDenied.response.status, 403);

  const partnerDenied = await apiRequest(
    partnerToken,
    "POST",
    `/decisions/${decisionId}/candidate-actions`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-PARTNER-DENY-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: deniedAction,
    },
  );
  assert.equal(partnerDenied.response.status, 403);

  console.log("S1 REC E2E: creating candidate actions");
  const broadDrill = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/candidate-actions`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-ACTION-DRILL-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        action_code: "BROAD_RESOURCE_DRILLING",
        title: "Broad resource-definition drilling",
        description:
          "Commit to a broad resource-definition drilling programme.",
        cost_class: "C4",
        technical_risk: "HIGH while system-core geometry remains uncertain",
        partner_dependency: false,
      },
    },
  );
  assert.ok([200, 201].includes(broadDrill.response.status));

  const reconcile = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/candidate-actions`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-ACTION-RECON-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        action_code: "3D_VMS_CORE_RECONCILIATION",
        title: "3D VMS core hypothesis reconciliation",
        description:
          "Integrate drilling, geology, alteration and deep geophysics before broad drilling.",
        cost_class: "C1",
        technical_risk: "LOW",
        partner_dependency: false,
      },
    },
  );
  assert.ok([200, 201].includes(reconcile.response.status));

  const targetedGeophysics = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/candidate-actions`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-ACTION-GEOPH-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        action_code: "TARGETED_DEEP_GEOPHYSICS",
        title: "Targeted deep geophysics",
        description:
          "Acquire focused geophysics to discriminate competing core hypotheses.",
        cost_class: "C3",
        technical_risk: "MEDIUM",
        partner_dependency: false,
      },
    },
  );
  assert.ok([200, 201].includes(targetedGeophysics.response.status));

  console.log("S1 REC E2E: proposing explicit Next-Best-Test");
  const nbt = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/next-best-tests`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-NBT-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        candidate_action_id: reconcile.body.candidate_action_id,
        test_type: "INTEGRATED_3D_RECONCILIATION",
        uncertainty_targeted: "Location and continuity of the VMS system core",
        expected_information_gain: "VERY_HIGH",
        cost_class: "C1",
        cost_range_min: 100000,
        cost_range_max: 250000,
        time_range: "Short technical work programme",
        dependencies: [
          "validated drilling database",
          "deep geophysical interpretation",
          "alteration model",
        ],
        technical_risk: "LOW",
        decision_impact:
          "Determines whether higher-cost resource-definition drilling is justified.",
        required_authority: "EXPLORATION_DIRECTOR",
      },
    },
  );
  assert.ok([200, 201].includes(nbt.response.status));
  assert.equal(nbt.body.status, "PROPOSED");
  assert.equal(nbt.body.expected_information_gain, "VERY_HIGH");
  assert.equal(nbt.body.cost_class, "C1");

  console.log("S1 REC E2E: issuing Recommendation v1");
  const rec1 = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/recommendations`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-V1-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        recommended_action_id: reconcile.body.candidate_action_id,
        recommendation_text:
          "Complete 3D VMS core reconciliation before any broad resource-definition drilling.",
        rationale:
          "This is the lowest-cost action with very high expected information gain.",
        confidence: "HIGH",
        model_version: "S1-RULESET-0.1",
      },
    },
  );
  assert.ok([200, 201].includes(rec1.response.status));
  assert.equal(rec1.body.recommendation_version, 1);
  assert.equal(rec1.body.decision_state, "DECISION_READY");
  assert.equal(rec1.body.decision_object_version, baselineDecisionVersion);

  console.log("S1 REC E2E: proving recommendation author cannot self-review");
  const selfReview = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/recommendations/${rec1.body.recommendation_id}/review`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-SELF-REVIEW-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        review_status: "ACCEPTED",
        rationale: "The recommendation author must not review their own recommendation.",
      },
    },
  );
  assert.equal(selfReview.response.status, 403);

  console.log("S1 REC E2E: independent Exploration Director accepts Recommendation v1");
  const review1 = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/recommendations/${rec1.body.recommendation_id}/review`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-REVIEW-V1-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        review_status: "ACCEPTED",
        rationale:
          "Accepted as the preferred technical uncertainty-reduction path; this is not execution or capital approval.",
      },
    },
  );
  assert.ok([200, 201].includes(review1.response.status));
  assert.equal(review1.body.review_status, "ACCEPTED");
  assert.equal(review1.body.decision_state, "DECISION_READY");
  assert.equal(review1.body.execution_authorised, false);
  assert.equal(review1.body.capital_release_authorised, false);

  const fetchedReview1 = await apiRequest(
    directorToken,
    "GET",
    `/decisions/${decisionId}/recommendations/${rec1.body.recommendation_id}/review`,
  );
  assert.equal(fetchedReview1.response.status, 200);
  assert.equal(fetchedReview1.body.review_status, "ACCEPTED");
  assert.equal(fetchedReview1.body.execution_authorised, false);

  console.log("S1 REC E2E: proving Recommendation review does not create approval");
  let intelligence = await apiRequest(
    directorToken,
    "GET",
    `/decisions/${decisionId}/intelligence`,
  );
  assert.equal(intelligence.response.status, 200);
  assert.equal(intelligence.body.current_recommendation.recommendation_version, 1);
  assert.equal(intelligence.body.decision_state, "DECISION_READY");
  assert.equal(intelligence.body.decision_object_version, baselineDecisionVersion);

  const pool2 = new Pool(dbConfig());
  try {
    const reviews = await pool2.query(
      `SELECT count(*)::int AS count
         FROM qassas_core.human_review
        WHERE decision_id = $1`,
      [decisionId],
    );
    assert.equal(Number(reviews.rows[0]?.count ?? 0), 0);
  } finally {
    await pool2.end();
  }

  console.log("S1 REC E2E: blocking silent supersession without RecommendationDelta trigger");
  const invalidSupersession = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/recommendations`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-V2-NO-DELTA-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        recommended_action_id: targetedGeophysics.body.candidate_action_id,
        recommendation_text: "Attempted silent recommendation replacement.",
        rationale: "This must fail because no change_trigger is supplied.",
        confidence: "HIGH",
        model_version: "S1-RULESET-0.1",
        supersedes_recommendation_id: rec1.body.recommendation_id,
      },
    },
  );
  assert.equal(invalidSupersession.response.status, 400);

  console.log("S1 REC E2E: issuing Recommendation v2 with explicit delta");
  const rec2 = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/recommendations`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-V2-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        recommended_action_id: targetedGeophysics.body.candidate_action_id,
        recommendation_text:
          "Run targeted deep geophysics before broad drilling, then reconcile the 3D system-core model.",
        rationale:
          "The reinterpretation increases the value of a focused subsurface discriminator before committing C4 drilling capital.",
        confidence: "VERY_HIGH",
        model_version: "S1-RULESET-0.1",
        supersedes_recommendation_id: rec1.body.recommendation_id,
        change_trigger: {
          trigger_type: "TECHNICAL_REINTERPRETATION",
          trigger_evidence_ids: [triggerEvidenceId],
          rationale:
            "Technical reinterpretation changed the preferred lowest-cost uncertainty-reduction path.",
          capital_impact:
            "Defers high-cost broad drilling until a lower-cost discriminator is completed.",
          gate_impact: "Retains the Decision at G6 / DECISION_READY pending HumanReview.",
        },
      },
    },
  );
  assert.ok([200, 201].includes(rec2.response.status));
  assert.equal(rec2.body.recommendation_version, 2);
  assert.equal(rec2.body.supersedes_recommendation_id, rec1.body.recommendation_id);
  assert.ok(rec2.body.delta_id);
  assert.equal(rec2.body.decision_state, "DECISION_READY");
  assert.equal(rec2.body.decision_object_version, baselineDecisionVersion);

  intelligence = await apiRequest(
    directorToken,
    "GET",
    `/decisions/${decisionId}/intelligence`,
  );
  assert.equal(intelligence.response.status, 200);
  assert.equal(intelligence.body.recommendations.length, 2);
  assert.equal(intelligence.body.recommendation_deltas.length, 1);
  assert.equal(
    intelligence.body.current_recommendation.recommendation_id,
    rec2.body.recommendation_id,
  );
  assert.equal(
    intelligence.body.recommendation_deltas[0].previous_recommendation_id,
    rec1.body.recommendation_id,
  );
  assert.equal(
    intelligence.body.recommendation_deltas[0].new_recommendation_id,
    rec2.body.recommendation_id,
  );

  console.log("S1 REC E2E: prior recommendation can no longer be reviewed as current");
  const staleReview = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/recommendations/${rec1.body.recommendation_id}/review`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-STALE-REVIEW-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        review_status: "ACCEPTED",
        rationale: "A superseded recommendation must not be treated as current.",
      },
    },
  );
  assert.equal(staleReview.response.status, 409);

  console.log("S1 REC E2E: independent Exploration Director accepts Recommendation v2");
  const review2 = await apiRequest(
    directorToken,
    "POST",
    `/decisions/${decisionId}/recommendations/${rec2.body.recommendation_id}/review`,
    {
      headers: {
        "x-qassas-idempotency-key": `S1-REC-REVIEW-V2-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        review_status: "ACCEPTED",
        rationale:
          "Accepted as current technical recommendation; execution and capital remain separately governed.",
      },
    },
  );
  assert.ok([200, 201].includes(review2.response.status));
  assert.equal(review2.body.review_status, "ACCEPTED");
  assert.equal(review2.body.decision_state, "DECISION_READY");
  assert.equal(review2.body.execution_authorised, false);
  assert.equal(review2.body.capital_release_authorised, false);

  console.log("S1 REC E2E: proving immutable recommendation history");
  const pool3 = new Pool(dbConfig());
  try {
    await assert.rejects(
      pool3.query(
        `UPDATE qassas_core.recommendation
            SET confidence = 'LOW'
          WHERE recommendation_id = $1`,
        [rec1.body.recommendation_id],
      ),
      /Decision intelligence records are immutable/,
    );

    const decision = await pool3.query(
      `SELECT state, object_version
         FROM qassas_core.decision_object
        WHERE decision_id = $1`,
      [decisionId],
    );
    assert.equal(decision.rows[0].state, "DECISION_READY");
    assert.equal(Number(decision.rows[0].object_version), baselineDecisionVersion);

    const reviews = await pool3.query(
      `SELECT count(*)::int AS count
         FROM qassas_core.human_review
        WHERE decision_id = $1`,
      [decisionId],
    );
    assert.equal(Number(reviews.rows[0]?.count ?? 0), 0);

    const recommendationReviews = await pool3.query(
      `SELECT recommendation_id, review_status
         FROM qassas_core.recommendation_review
        WHERE decision_id = $1
        ORDER BY created_at`,
      [decisionId],
    );
    assert.equal(recommendationReviews.rows.length, 2);
    assert.ok(
      recommendationReviews.rows.every(
        (row) => row.review_status === "ACCEPTED",
      ),
    );

    await waitUntil("Recommendation outbox publication", async () => {
      const pending = await pool3.query(
        `SELECT count(*)::int AS count
           FROM qassas_outbox.outbox_event
          WHERE correlation_id = $1
            AND published_at IS NULL`,
        [correlationId],
      );
      return Number(pending.rows[0]?.count ?? 0) === 0;
    });

    const auditCounts = await pool3.query(
      `SELECT event_type, count(*)::int AS count
         FROM qassas_audit.audit_event
        WHERE correlation_id = $1
        GROUP BY event_type`,
      [correlationId],
    );
    const audit = Object.fromEntries(
      auditCounts.rows.map((row) => [row.event_type, Number(row.count)]),
    );
    assert.ok((audit.CandidateActionCreated ?? 0) >= 3);
    assert.ok((audit.NextBestTestProposed ?? 0) >= 1);
    assert.equal(audit.RecommendationIssued ?? 0, 1);
    assert.equal(audit.RecommendationChanged ?? 0, 1);
    assert.equal(audit.RecommendationAccepted ?? 0, 2);
    assert.ok((audit.AccessDenied ?? 0) >= 3);
  } finally {
    await pool3.end();
  }

  console.log("E2E-S1-RECOMMENDATION-001 PASS", {
    decisionId,
    snapshotId,
    nextBestTestId: nbt.body.test_id,
    recommendationV1: rec1.body.recommendation_id,
    recommendationV2: rec2.body.recommendation_id,
    deltaId: rec2.body.delta_id,
    recommendationReviewV1: review1.body.review_id,
    recommendationReviewV2: review2.body.review_id,
  });
}

await main();
