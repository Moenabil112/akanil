import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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

const agreementId = `AGR-M2-CHECK-${randomUUID()}`;
const connectionId = `PSC-M2-CHECK-${randomUUID()}`;
const runId = `ING-M2-CHECK-${randomUUID()}`;

try {
  const documentHash = createHash("sha256")
    .update("M2-contract-check")
    .digest("hex");

  await client.query(
    `INSERT INTO qassas_core.institution_access_agreement (
       agreement_id, institution_id, agreement_type, agreement_status,
       document_ref, document_hash, allowed_domains, effective_from,
       approved_by_user_id
     )
     VALUES (
       $1,'INST-ATLAS-GOLDEN-KSA','TERM_SHEET','ACTIVE',
       'CHECK://ATLAS/M2',$2,'["ASSAYS","PRIVATE_GEOLOGY"]'::jsonb,
       now() - interval '1 minute','USR-E2E-ATLAS'
     )`,
    [agreementId, documentHash],
  );

  let invalidDomainRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.institution_access_agreement (
         agreement_id, institution_id, agreement_type, agreement_status,
         document_ref, document_hash, allowed_domains, effective_from,
         approved_by_user_id
       )
       VALUES (
         $1,'INST-ATLAS-GOLDEN-KSA','TERM_SHEET','ACTIVE',
         'CHECK://ATLAS/INVALID',$2,'["NOT_A_REAL_DOMAIN"]'::jsonb,
         now() - interval '1 minute','USR-E2E-ATLAS'
       )`,
      [`AGR-M2-INVALID-${randomUUID()}`, documentHash],
    );
  } catch (error) {
    invalidDomainRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /unsupported private data domain/i,
    );
  }
  assert.equal(invalidDomainRejected, true);

  let crossTenantRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.portfolio_private_source_connection (
         connection_id, portfolio_id, source_id, agreement_id,
         connection_status, allowed_domains, activated_by_user_id,
         correlation_id
       )
       VALUES (
         $1,'PORT-ARTAR-KSA','SRC-PARTNER-TERM-SHEET',$2,
         'CONNECTED','["ASSAYS"]'::jsonb,'USR-E2E-ATLAS','CORR-M2-CROSS'
       )`,
      [`PSC-M2-CROSS-${randomUUID()}`, agreementId],
    );
  } catch (error) {
    crossTenantRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /does not match portfolio institution/i,
    );
  }
  assert.equal(crossTenantRejected, true);

  let scopeExpansionRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.portfolio_private_source_connection (
         connection_id, portfolio_id, source_id, agreement_id,
         connection_status, allowed_domains, activated_by_user_id,
         correlation_id
       )
       VALUES (
         $1,'PORT-ATLAS-GOLDEN-KSA','SRC-PARTNER-TERM-SHEET',$2,
         'CONNECTED','["ASSAYS","DRILLING"]'::jsonb,'USR-E2E-ATLAS','CORR-M2-SCOPE'
       )`,
      [`PSC-M2-SCOPE-${randomUUID()}`, agreementId],
    );
  } catch (error) {
    scopeExpansionRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /exceeds agreement scope/i,
    );
  }
  assert.equal(scopeExpansionRejected, true);

  await client.query(
    `UPDATE qassas_core.portfolio_data_source
        SET access_status = 'CONNECTED',
            agreement_id = $1,
            allowed_domains = '["ASSAYS","PRIVATE_GEOLOGY"]'::jsonb
      WHERE portfolio_id = 'PORT-ATLAS-GOLDEN-KSA'
        AND source_id = 'SRC-PARTNER-TERM-SHEET'`,
    [agreementId],
  );

  await client.query(
    `INSERT INTO qassas_core.portfolio_private_source_connection (
       connection_id, portfolio_id, source_id, agreement_id,
       connection_status, allowed_domains, activated_by_user_id,
       correlation_id
     )
     VALUES (
       $1,'PORT-ATLAS-GOLDEN-KSA','SRC-PARTNER-TERM-SHEET',$2,
       'CONNECTED','["ASSAYS","PRIVATE_GEOLOGY"]'::jsonb,
       'USR-E2E-ATLAS','CORR-M2-CONNECT'
     )`,
    [connectionId, agreementId],
  );

  await client.query(
    `INSERT INTO qassas_core.source_ingestion_run (
       ingestion_run_id, portfolio_id, source_id, trigger_type,
       source_snapshot_ref, requested_by_user_id, correlation_id, status
     )
     VALUES (
       $1,'PORT-ATLAS-GOLDEN-KSA','SRC-PARTNER-TERM-SHEET',
       'PARTNER_DELIVERY','CHECK://ATLAS/DELIVERY','USR-E2E-ATLAS',
       'CORR-M2-RUN','STARTED'
     )`,
    [runId],
  );

  const runSnapshot = await client.query(
    `SELECT source_class_snapshot, agreement_id_snapshot,
            allowed_domains_snapshot
       FROM qassas_core.source_ingestion_run
      WHERE ingestion_run_id = $1`,
    [runId],
  );
  assert.equal(runSnapshot.rows[0].source_class_snapshot, "PRIVATE_CONTRACTUAL");
  assert.equal(runSnapshot.rows[0].agreement_id_snapshot, agreementId);
  assert.deepEqual(
    [...runSnapshot.rows[0].allowed_domains_snapshot].sort(),
    ["ASSAYS", "PRIVATE_GEOLOGY"],
  );

  let outOfScopeRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.source_ingestion_record (
         ingestion_record_id, ingestion_run_id, source_object_id,
         source_object_type, retrieved_at, payload_hash,
         validation_status, data_domain, security_class, provenance
       )
       VALUES (
         $1,$2,'DRILL-001','DRILLHOLE',now(),$3,
         'ACCEPTED','DRILLING','C0_PUBLIC','{}'::jsonb
       )`,
      [
        `IR-M2-BLOCK-${randomUUID()}`,
        runId,
        createHash("sha256").update("blocked").digest("hex"),
      ],
    );
  } catch (error) {
    outOfScopeRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /outside agreement scope/i,
    );
  }
  assert.equal(outOfScopeRejected, true);

  const acceptedId = `IR-M2-ACCEPT-${randomUUID()}`;
  await client.query(
    `INSERT INTO qassas_core.source_ingestion_record (
       ingestion_record_id, ingestion_run_id, source_object_id,
       source_object_type, retrieved_at, payload_hash,
       validation_status, data_domain, security_class, provenance
     )
     VALUES (
       $1,$2,'ASSAY-001','ASSAY_RESULT',now(),$3,
       'ACCEPTED','ASSAYS','C0_PUBLIC',
       '{"document_ref":"CHECK://ATLAS/ASSAY-001"}'::jsonb
     )`,
    [
      acceptedId,
      runId,
      createHash("sha256").update("accepted").digest("hex"),
    ],
  );

  const accepted = await client.query(
    `SELECT agreement_id_snapshot, data_domain, security_class
       FROM qassas_core.source_ingestion_record
      WHERE ingestion_record_id = $1`,
    [acceptedId],
  );
  assert.equal(accepted.rows[0].agreement_id_snapshot, agreementId);
  assert.equal(accepted.rows[0].data_domain, "ASSAYS");
  assert.equal(
    accepted.rows[0].security_class,
    "C2_CONFIDENTIAL_TECHNICAL",
  );

  await client.query(
    `UPDATE qassas_core.institution_access_agreement
        SET agreement_status = 'TERMINATED',
            effective_to = now(),
            updated_at = now()
      WHERE agreement_id = $1`,
    [agreementId],
  );

  const postTermination = await client.query(
    `SELECT s.access_status, c.connection_status
       FROM qassas_core.portfolio_data_source s
       JOIN qassas_core.portfolio_private_source_connection c
         ON c.portfolio_id = s.portfolio_id
        AND c.source_id = s.source_id
        AND c.agreement_id = s.agreement_id
      WHERE s.portfolio_id = 'PORT-ATLAS-GOLDEN-KSA'
        AND s.source_id = 'SRC-PARTNER-TERM-SHEET'`,
  );
  assert.equal(postTermination.rows[0].access_status, "AGREEMENT_REQUIRED");
  assert.equal(postTermination.rows[0].connection_status, "SUSPENDED");

  let postTerminationRunRejected = false;
  try {
    await client.query(
      `INSERT INTO qassas_core.source_ingestion_run (
         ingestion_run_id, portfolio_id, source_id, trigger_type,
         requested_by_user_id, correlation_id, status
       )
       VALUES (
         $1,'PORT-ATLAS-GOLDEN-KSA','SRC-PARTNER-TERM-SHEET',
         'PARTNER_DELIVERY','USR-E2E-ATLAS','CORR-M2-AFTER','STARTED'
       )`,
      [`ING-M2-AFTER-${randomUUID()}`],
    );
  } catch (error) {
    postTerminationRunRejected = true;
    assert.match(
      error instanceof Error ? error.message : String(error),
      /requires active contractual connection/i,
    );
  }
  assert.equal(postTerminationRunRejected, true);

  const preserved = await client.query(
    `SELECT agreement_id_snapshot, allowed_domains_snapshot
       FROM qassas_core.source_ingestion_run
      WHERE ingestion_run_id = $1`,
    [runId],
  );
  assert.equal(preserved.rows[0].agreement_id_snapshot, agreementId);
  assert.deepEqual(
    [...preserved.rows[0].allowed_domains_snapshot].sort(),
    ["ASSAYS", "PRIVATE_GEOLOGY"],
  );

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        invalid_contract_domain: "BLOCKED",
        cross_tenant_agreement_use: "BLOCKED",
        connection_scope_expansion: "BLOCKED",
        private_run_agreement_snapshot: "PASS",
        out_of_scope_private_record: "BLOCKED",
        in_scope_private_record: "ACCEPTED",
        private_security_class_upgrade: "PASS",
        agreement_termination_suspends_connection: "PASS",
        post_termination_ingestion: "BLOCKED",
        historical_agreement_snapshot: "PRESERVED",
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
