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
  console.log("E2E-S1-EVIDENCE-001: waiting for QASSAS services");

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

  const password = `s1-${randomBytes(18).toString("hex")}`;
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

  const correlationId = `CORR-S1-EVIDENCE-${runId}`;

  console.log("S1 E2E: proving Evidence write authorization boundaries");
  const deniedBody = {
    target_id: "TGT-AS-CORE-001",
    evidence_class: "DRILLING",
    source_system: "SPRINT1_E2E_DENIED",
    observation: "This evidence write must be denied.",
  };

  const partnerDenied = await apiRequest(partnerToken, "POST", "/evidence", {
    headers: {
      "x-qassas-idempotency-key": `S1-PARTNER-DENY-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: deniedBody,
  });
  assert.equal(partnerDenied.response.status, 403);

  const adminDenied = await apiRequest(adminUserToken, "POST", "/evidence", {
    headers: {
      "x-qassas-idempotency-key": `S1-ADMIN-DENY-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: deniedBody,
  });
  assert.equal(adminDenied.response.status, 403);

  console.log("S1 E2E: registering controlled EvidenceObjects");
  const drilling = await apiRequest(geoToken, "POST", "/evidence", {
    headers: {
      "x-qassas-idempotency-key": `S1-EVD-DRILL-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      evidence_class: "DRILLING",
      source_system: "SPRINT1_E2E",
      source_object_id: `S1-DRILL-${runId}`,
      source_org: "Synthetic GMCO Pilot",
      source_type: "DRILL_CAMPAIGN",
      version_label: "Rev 1",
      observation:
        "Synthetic drill evidence confirms mineralisation but not complete system geometry.",
      qa_qc_status: "QAQC_ACCEPTABLE",
    },
  });
  assert.ok([200, 201].includes(drilling.response.status));
  assert.equal(drilling.body.object_version, 1);
  const drillingId = drilling.body.evidence_id;

  const geophysics = await apiRequest(geoToken, "POST", "/evidence", {
    headers: {
      "x-qassas-idempotency-key": `S1-EVD-GEO-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      evidence_class: "GEOPHYSICS",
      source_system: "SPRINT1_E2E",
      source_object_id: `S1-GEOPHYS-${runId}`,
      source_org: "Synthetic GMCO Pilot",
      source_type: "3D_INTERPRETATION",
      version_label: "Rev 1",
      observation:
        "Synthetic deep geophysical interpretation indicates an alternative core geometry.",
      qa_qc_status: "INTERPRETATION_REVIEWED",
    },
  });
  assert.ok([200, 201].includes(geophysics.response.status));
  const geophysicsId = geophysics.body.evidence_id;

  const unqualified = await apiRequest(geoToken, "POST", "/evidence", {
    headers: {
      "x-qassas-idempotency-key": `S1-EVD-UNQUAL-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      evidence_class: "ALTERATION",
      source_system: "SPRINT1_E2E",
      source_object_id: `S1-ALT-${runId}`,
      observation: "Synthetic unqualified alteration evidence.",
    },
  });
  assert.ok([200, 201].includes(unqualified.response.status));
  const unqualifiedId = unqualified.body.evidence_id;

  console.log("S1 E2E: writing append-only qualification history");
  const drillQ1 = await apiRequest(
    geoToken,
    "POST",
    `/evidence/${drillingId}/qualifications`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `S1-Q1-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        validation_status: "SOURCE_VERIFIED",
        decision_fitness: "VALIDATED",
        confidence_class: "B",
        limitations: "Geometry remains incomplete.",
        rationale: "Source and campaign identity verified.",
      },
    },
  );
  assert.ok([200, 201].includes(drillQ1.response.status));
  assert.equal(drillQ1.body.object_version, 2);

  const drillQ2 = await apiRequest(
    geoToken,
    "POST",
    `/evidence/${drillingId}/qualifications`,
    {
      headers: {
        "if-match": "2",
        "x-qassas-idempotency-key": `S1-Q2-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        validation_status: "TECHNICALLY_VALIDATED",
        decision_fitness: "DECISION_GRADE",
        confidence_class: "A",
        limitations: "Vent-proximal/core geometry still unresolved.",
        rationale:
          "Technical validation completed for use in the Discovery-to-Resource decision.",
      },
    },
  );
  assert.ok([200, 201].includes(drillQ2.response.status));
  assert.equal(drillQ2.body.object_version, 3);

  const staleQualification = await apiRequest(
    geoToken,
    "POST",
    `/evidence/${drillingId}/qualifications`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `S1-Q-STALE-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        validation_status: "TECHNICALLY_VALIDATED",
        decision_fitness: "DECISION_GRADE",
        confidence_class: "A",
        rationale: "A stale write must not overwrite evidence state.",
      },
    },
  );
  assert.equal(staleQualification.response.status, 409);

  const geoQ1 = await apiRequest(
    directorToken,
    "POST",
    `/evidence/${geophysicsId}/qualifications`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `S1-GEO-Q1-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        validation_status: "QUALIFIED_WITH_LIMITATIONS",
        decision_fitness: "QUALIFIED_WITH_LIMITATIONS",
        confidence_class: "B",
        limitations: "Interpretation conflicts with current drill-led geometry.",
        rationale:
          "Technically useful, but requires explicit conflict resolution before execution capital.",
      },
    },
  );
  assert.ok([200, 201].includes(geoQ1.response.status));
  assert.equal(geoQ1.body.object_version, 2);

  const evidenceHistory = await apiRequest(
    geoToken,
    "GET",
    `/evidence/${drillingId}`,
  );
  assert.equal(evidenceHistory.response.status, 200);
  assert.equal(evidenceHistory.body.qualifications.length, 2);
  assert.deepEqual(
    evidenceHistory.body.qualifications.map((q) => q.confidence_class),
    ["B", "A"],
  );

  console.log("S1 E2E: blocking unqualified evidence from a snapshot");
  const badSnapshot = await apiRequest(geoToken, "POST", "/evidence/snapshots", {
    headers: {
      "x-qassas-idempotency-key": `S1-SNAPSHOT-BAD-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      evidence_ids: [drillingId, unqualifiedId],
    },
  });
  assert.equal(badSnapshot.response.status, 409);

  console.log("S1 E2E: locking immutable EvidenceSnapshot");
  const snapshot = await apiRequest(geoToken, "POST", "/evidence/snapshots", {
    headers: {
      "x-qassas-idempotency-key": `S1-SNAPSHOT-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      evidence_ids: [drillingId, geophysicsId],
    },
  });
  assert.ok([200, 201].includes(snapshot.response.status));
  assert.equal(snapshot.body.snapshot_status, "LOCKED");
  assert.equal(snapshot.body.evidence_count, 2);
  const snapshotId = snapshot.body.snapshot_id;

  const snapshotBeforeChange = await apiRequest(
    geoToken,
    "GET",
    `/evidence/snapshots/${snapshotId}`,
  );
  assert.equal(snapshotBeforeChange.response.status, 200);
  const frozenDrill = snapshotBeforeChange.body.items.find(
    (item) => item.evidence_id === drillingId,
  );
  assert.equal(frozenDrill.evidence_object_version, 3);
  assert.equal(frozenDrill.qualification_id, drillQ2.body.qualification_id);

  const partnerSnapshot = await apiRequest(
    partnerToken,
    "GET",
    `/evidence/snapshots/${snapshotId}`,
  );
  assert.equal(partnerSnapshot.response.status, 404);

  console.log("S1 E2E: proving snapshot immutability after later evidence change");
  const drillQ3 = await apiRequest(
    directorToken,
    "POST",
    `/evidence/${drillingId}/qualifications`,
    {
      headers: {
        "if-match": "3",
        "x-qassas-idempotency-key": `S1-Q3-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        validation_status: "QUALIFIED_WITH_LIMITATIONS",
        decision_fitness: "QUALIFIED_WITH_LIMITATIONS",
        confidence_class: "B",
        limitations:
          "New interpretation increases uncertainty in the current system-core hypothesis.",
        rationale:
          "New evidence changes current qualification but must not rewrite the locked snapshot.",
      },
    },
  );
  assert.ok([200, 201].includes(drillQ3.response.status));
  assert.equal(drillQ3.body.object_version, 4);

  const snapshotAfterChange = await apiRequest(
    geoToken,
    "GET",
    `/evidence/snapshots/${snapshotId}`,
  );
  const frozenAfter = snapshotAfterChange.body.items.find(
    (item) => item.evidence_id === drillingId,
  );
  assert.equal(frozenAfter.evidence_object_version, 3);
  assert.equal(frozenAfter.qualification_id, drillQ2.body.qualification_id);
  assert.equal(frozenAfter.decision_fitness, "DECISION_GRADE");

  console.log("S1 E2E: opening governed Discovery-to-Resource Decision");
  const opened = await apiRequest(geoToken, "POST", "/decisions", {
    headers: {
      "x-qassas-idempotency-key": `S1-DECISION-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      decision_class: "DISCOVERY_REVIEW",
      decision_question:
        "Does the controlled evidence support progression toward resource-definition drilling?",
      trigger_type: "SPRINT1_EVIDENCE_GOVERNANCE",
      current_gate: "G6_DISCOVERY",
    },
  });
  assert.ok([200, 201].includes(opened.response.status));
  const decisionId = opened.body.decision_id;
  assert.equal(opened.body.object_version, 1);

  console.log("S1 E2E: opening explicit blocking DataGap");
  const gap = await apiRequest(geoToken, "POST", "/evidence/data-gaps", {
    headers: {
      "x-qassas-idempotency-key": `S1-GAP-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      decision_id: decisionId,
      required_information:
        "Reconciled 3D VMS core hypothesis linking drilling, alteration and deep geophysics.",
      why_required:
        "The next drilling programme cannot be justified while core geometry remains unresolved.",
      potential_source: "Integrated 3D interpretation",
      cost_class: "C1",
      decision_impact: "Blocks progression to resource-definition drilling.",
      blocking_status: "BLOCKING",
    },
  });
  assert.ok([200, 201].includes(gap.response.status));
  assert.equal(gap.body.status, "OPEN");

  console.log("S1 E2E: preserving contradictory evidence as CF-4 conflict");
  const conflict = await apiRequest(
    geoToken,
    "POST",
    "/evidence/conflicts",
    {
      headers: {
        "x-qassas-idempotency-key": `S1-CONFLICT-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: {
        target_id: "TGT-AS-CORE-001",
        decision_id: decisionId,
        evidence_ids: [drillingId, geophysicsId],
        conflict_type: "VMS_CORE_GEOMETRY_CONFLICT",
        severity: "CF-4",
        technical_interpretation:
          "Drill-led fringe interpretation and deep geophysical core hypothesis are materially inconsistent.",
        decision_impact:
          "Broad resource-definition drilling must remain blocked until the system-core hypothesis is reconciled.",
        resolution_method:
          "Integrated drilling-geology-alteration-geophysics 3D reconciliation.",
      },
    },
  );
  assert.ok([200, 201].includes(conflict.response.status));
  assert.equal(conflict.body.severity, "CF-4");

  console.log("S1 E2E: binding immutable snapshot to DecisionObject");
  const binding = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/evidence-snapshot`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `S1-BIND-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: { snapshot_id: snapshotId },
    },
  );
  assert.ok([200, 201].includes(binding.response.status));
  assert.equal(binding.body.state, "CONFLICT_RESOLUTION_REQUIRED");
  assert.equal(binding.body.blocking_gap_count, 1);
  assert.equal(binding.body.blocking_conflict_count, 1);
  assert.equal(binding.body.object_version, 2);

  console.log("S1 E2E: blocking HumanReview while evidence conflict remains");
  const blockedReview = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${decisionId}/reviews`,
    {
      headers: {
        "if-match": "2",
        "x-qassas-idempotency-key": `S1-BLOCKED-REVIEW-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
    },
  );
  assert.equal(blockedReview.response.status, 409);

  console.log("S1 E2E: proving clean Decision derives DECISION_READY");
  const readyDecision = await apiRequest(geoToken, "POST", "/decisions", {
    headers: {
      "x-qassas-idempotency-key": `S1-READY-DEC-${runId}`,
      "x-qassas-correlation-id": correlationId,
    },
    body: {
      target_id: "TGT-AS-CORE-001",
      decision_class: "DISCOVERY_REVIEW",
      decision_question:
        "Can the locked evidence snapshot proceed to independent HumanReview?",
      trigger_type: "SPRINT1_READY_BRANCH",
      current_gate: "G6_DISCOVERY",
    },
  });
  const readyDecisionId = readyDecision.body.decision_id;

  const readyBinding = await apiRequest(
    geoToken,
    "POST",
    `/decisions/${readyDecisionId}/evidence-snapshot`,
    {
      headers: {
        "if-match": "1",
        "x-qassas-idempotency-key": `S1-READY-BIND-${runId}`,
        "x-qassas-correlation-id": correlationId,
      },
      body: { snapshot_id: snapshotId },
    },
  );
  assert.ok([200, 201].includes(readyBinding.response.status));
  assert.equal(readyBinding.body.state, "DECISION_READY");
  assert.equal(readyBinding.body.blocking_gap_count, 0);
  assert.equal(readyBinding.body.blocking_conflict_count, 0);

  const pool = new Pool(dbConfig());
  try {
    console.log("S1 E2E: proving database-level snapshot immutability");
    await assert.rejects(
      pool.query(
        `UPDATE qassas_core.evidence_snapshot
            SET snapshot_status = 'LOCKED'
          WHERE snapshot_id = $1`,
        [snapshotId],
      ),
      /Evidence snapshots are immutable/,
    );

    await waitUntil("Sprint 1 outbox publication", async () => {
      const pending = await pool.query(
        `SELECT count(*)::int AS count
           FROM qassas_outbox.outbox_event
          WHERE aggregate_id = ANY($1::text[])
            AND published_at IS NULL`,
        [
          [
            drillingId,
            geophysicsId,
            snapshotId,
            gap.body.gap_id,
            conflict.body.conflict_id,
            decisionId,
            readyDecisionId,
          ],
        ],
      );
      return Number(pending.rows[0]?.count ?? 0) === 0;
    });

    const bindings = await pool.query(
      `SELECT decision_id, snapshot_id, derived_state,
              blocking_gap_count, blocking_conflict_count
         FROM qassas_core.decision_evidence_binding
        WHERE decision_id = ANY($1::text[])
        ORDER BY bound_at`,
      [[decisionId, readyDecisionId]],
    );
    assert.equal(bindings.rows.length, 2);
    assert.equal(
      bindings.rows.find((row) => row.decision_id === decisionId)
        ?.derived_state,
      "CONFLICT_RESOLUTION_REQUIRED",
    );
    assert.equal(
      bindings.rows.find((row) => row.decision_id === readyDecisionId)
        ?.derived_state,
      "DECISION_READY",
    );

    const snapshotItems = await pool.query(
      `SELECT evidence_id, evidence_object_version, qualification_id
         FROM qassas_core.evidence_snapshot_item
        WHERE snapshot_id = $1
        ORDER BY evidence_id`,
      [snapshotId],
    );
    assert.equal(snapshotItems.rows.length, 2);
    const frozenDbDrill = snapshotItems.rows.find(
      (row) => row.evidence_id === drillingId,
    );
    assert.equal(Number(frozenDbDrill.evidence_object_version), 3);
    assert.equal(frozenDbDrill.qualification_id, drillQ2.body.qualification_id);

    const auditCounts = await pool.query(
      `SELECT event_type, count(*)::int AS count
         FROM qassas_audit.audit_event
        WHERE correlation_id = $1
        GROUP BY event_type`,
      [correlationId],
    );
    const audit = Object.fromEntries(
      auditCounts.rows.map((row) => [row.event_type, Number(row.count)]),
    );
    assert.ok((audit.EvidenceRegistered ?? 0) >= 3);
    assert.ok((audit.EvidenceQualified ?? 0) >= 4);
    assert.ok((audit.EvidenceSnapshotLocked ?? 0) >= 1);
    assert.ok((audit.DataGapOpened ?? 0) >= 1);
    assert.ok((audit.EvidenceConflictOpened ?? 0) >= 1);
    assert.ok((audit.DecisionEvidenceBound ?? 0) >= 2);
    assert.ok((audit.AccessDenied ?? 0) >= 2);
  } finally {
    await pool.end();
  }

  console.log("S1 E2E: reconstructing governed Decision audit");
  const decisionAudit = await apiRequest(
    directorToken,
    "GET",
    `/audit/objects/${decisionId}`,
  );
  assert.equal(decisionAudit.response.status, 200);
  assert.deepEqual(
    decisionAudit.body.map((event) => event.event_type),
    ["DecisionOpened", "DecisionEvidenceBound"],
  );

  console.log("E2E-S1-EVIDENCE-001 PASS", {
    drillingId,
    geophysicsId,
    snapshotId,
    gapId: gap.body.gap_id,
    conflictId: conflict.body.conflict_id,
    blockedDecisionId: decisionId,
    readyDecisionId,
  });
}

await main();
