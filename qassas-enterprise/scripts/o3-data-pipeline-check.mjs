import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "pg";

const { Client } = pg;

const client = new Client(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.QASSAS_DB_HOST ?? "127.0.0.1",
        port: Number(process.env.QASSAS_DB_PORT ?? 5432),
        database: process.env.QASSAS_DB_NAME ?? "qassas",
        user: process.env.QASSAS_DB_USER ?? "qassas",
        password: process.env.QASSAS_DB_PASSWORD ?? "",
      },
);

await client.connect();

try {
  const adapters = await client.query(
    "SELECT adapter_id, source_id, adapter_status FROM qassas_core.source_adapter_contract ORDER BY adapter_id",
  );
  assert.equal(adapters.rowCount, 5, "expected five governed adapter contracts");

  const ngdAdapters = adapters.rows.filter((row) => row.source_id === "SRC-SGS-NGD");
  assert.equal(ngdAdapters.length, 2, "NGD must expose catalog + WFS adapter contracts");

  const taadeenAdapters = adapters.rows.filter((row) => row.source_id === "SRC-TAADEN");
  assert.equal(taadeenAdapters.length, 2, "Taadeen must expose licence + investor public record adapters");

  const partnerAdapter = adapters.rows.find((row) => row.source_id === "SRC-PARTNER-TERM-SHEET");
  assert.ok(partnerAdapter);
  assert.equal(partnerAdapter.adapter_status, "TERM_SHEET_REQUIRED");

  await client.query(
    `INSERT INTO qassas_security.user_identity (user_id, external_subject, status)
     VALUES
       ('USR-CI-ATLAS', 'ci-atlas-subject', 'ACTIVE'),
       ('USR-CI-ARTAR', 'ci-artar-subject', 'ACTIVE')
     ON CONFLICT (user_id) DO NOTHING`,
  );

  await client.query(
    `INSERT INTO qassas_security.institution_membership (
       membership_id, institution_id, user_id, institution_role, status, effective_from
     )
     VALUES
       ('MEM-CI-ATLAS', 'INST-ATLAS-GOLDEN-KSA', 'USR-CI-ATLAS', 'INSTITUTION_ADMIN', 'ACTIVE', now()),
       ('MEM-CI-ARTAR', 'INST-ARTAR-KSA', 'USR-CI-ARTAR', 'INSTITUTION_ADMIN', 'ACTIVE', now())
     ON CONFLICT (membership_id) DO NOTHING`,
  );

  const atlasScope = await client.query(
    "SELECT enterprise_id FROM qassas_security.institution_member_enterprise_scope WHERE user_id = 'USR-CI-ATLAS'",
  );
  assert.deepEqual(
    atlasScope.rows.map((row) => row.enterprise_id),
    ["ENT-ATLAS-GOLDEN-KSA"],
    "Atlas member must resolve only Atlas enterprise scope",
  );

  const artarScope = await client.query(
    "SELECT enterprise_id FROM qassas_security.institution_member_enterprise_scope WHERE user_id = 'USR-CI-ARTAR'",
  );
  assert.deepEqual(
    artarScope.rows.map((row) => row.enterprise_id),
    ["ENT-ARTAR-KSA"],
    "ARTAR member must resolve only ARTAR enterprise scope",
  );

  let privateRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.source_ingestion_run (
         ingestion_run_id, portfolio_id, source_id, trigger_type,
         correlation_id, status
       )
       VALUES (
         'ING-CI-PRIVATE-BLOCK',
         'PORT-ATLAS-GOLDEN-KSA',
         'SRC-PARTNER-TERM-SHEET',
         'PARTNER_DELIVERY',
         'CORR-CI-PRIVATE-BLOCK',
         'STARTED'
       )`,
    );
  } catch (error) {
    privateRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /requires connected contractual access/i,
    );
  }
  assert.equal(privateRejected, true, "private source must fail closed before Term Sheet activation");

  await client.query(
    `INSERT INTO qassas_core.source_ingestion_run (
       ingestion_run_id, portfolio_id, source_id, trigger_type,
       source_snapshot_ref, correlation_id, status
     )
     VALUES (
       'ING-CI-TAADEN-ARTAR',
       'PORT-ARTAR-KSA',
       'SRC-TAADEN',
       'SOURCE_CHANGE',
       'https://taadeen.sa/en/mining-info/investors/7007259752',
       'CORR-CI-TAADEN-ARTAR',
       'STARTED'
     )
     ON CONFLICT (ingestion_run_id) DO NOTHING`,
  );

  const payloadHash = createHash("sha256")
    .update("TAADEN:CI-LIC-001:2026-09-07")
    .digest("hex");

  await client.query(
    `INSERT INTO qassas_core.source_ingestion_record (
       ingestion_record_id, ingestion_run_id, source_object_id,
       source_object_type, source_version, retrieved_at, payload_hash,
       normalized_object_type, normalized_object_id, validation_status,
       security_class, provenance
     )
     VALUES (
       'IR-CI-TAADEN-CI-LIC-001',
       'ING-CI-TAADEN-ARTAR',
       'CI-LIC-001',
       'EXPLORATION_LICENCE',
       '2026-09-07',
       now(),
       $1,
       'PORTFOLIO_ASSET',
       'AST-CI-ARTAR-LIC001',
       'ACCEPTED',
       'C0_PUBLIC',
       '{"source_url":"https://taadeen.sa/en/mining-info/licenses/CI-LIC-001","source_authority":"Ministry of Industry and Mineral Resources"}'::jsonb
     )
     ON CONFLICT (ingestion_record_id) DO NOTHING`,
    [payloadHash],
  );

  await client.query(
    `UPDATE qassas_core.source_ingestion_run
        SET status = 'COMPLETED',
            completed_at = now(),
            record_count = 1,
            accepted_count = 1,
            rejected_count = 0,
            content_manifest_hash = $2
      WHERE ingestion_run_id = $1`,
    [
      "ING-CI-TAADEN-ARTAR",
      createHash("sha256").update(payloadHash).digest("hex"),
    ],
  );

  await client.query(
    `INSERT INTO qassas_core.portfolio_asset_registry (
       asset_id, portfolio_id, enterprise_id, asset_name, asset_type,
       external_licence_number, region, area_km2, mineral_classes,
       source_of_record_id, source_object_id, master_data_status,
       security_class, public_data_last_seen_at
     )
     VALUES (
       'AST-CI-ARTAR-LIC001',
       'PORT-ARTAR-KSA',
       'ENT-ARTAR-KSA',
       'CI Synthetic Public Licence',
       'EXPLORATION_LICENCE',
       'CI-LIC-001',
       'Riyadh',
       12.5,
       '["CLASS_A"]'::jsonb,
       'SRC-TAADEN',
       'CI-LIC-001',
       'PUBLIC_VERIFIED',
       'C0_PUBLIC',
       now()
     )
     ON CONFLICT (asset_id) DO NOTHING`,
  );

  await client.query(
    `INSERT INTO qassas_core.asset_source_identity (
       source_id, source_object_id, asset_id, match_method,
       identity_confidence, last_seen_at
     )
     VALUES (
       'SRC-TAADEN',
       'CI-LIC-001',
       'AST-CI-ARTAR-LIC001',
       'EXACT_PUBLIC_ID',
       1,
       now()
     )
     ON CONFLICT (source_id, source_object_id) DO UPDATE
     SET last_seen_at = now()`,
  );

  const targetCheck = await client.query(
    "SELECT count(*)::int AS target_count FROM qassas_core.target WHERE asset_id = 'AST-CI-ARTAR-LIC001'",
  );
  assert.equal(
    targetCheck.rows[0].target_count,
    0,
    "public ingestion must never auto-create a geological Target",
  );

  const status = await client.query(
    `SELECT latest_ingestion_status, latest_record_count, latest_accepted_count
       FROM qassas_core.portfolio_data_pipeline_status
      WHERE portfolio_id = 'PORT-ARTAR-KSA'
        AND source_id = 'SRC-TAADEN'`,
  );
  assert.equal(status.rows[0].latest_ingestion_status, "COMPLETED");
  assert.equal(Number(status.rows[0].latest_record_count), 1);
  assert.equal(Number(status.rows[0].latest_accepted_count), 1);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        tenant_isolation: "PASS",
        atlas_enterprise_scope: atlasScope.rows[0].enterprise_id,
        artar_enterprise_scope: artarScope.rows[0].enterprise_id,
        private_term_sheet_gate: "PASS",
        public_ingestion_ledger: "PASS",
        public_asset_registry: "PASS",
        public_ingestion_auto_target_count: 0,
        adapters: adapters.rowCount,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
