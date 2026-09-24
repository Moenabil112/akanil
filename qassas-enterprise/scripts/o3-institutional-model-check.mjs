import assert from "node:assert/strict";
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
  const directory = await client.query(
    "SELECT * FROM qassas_core.institution_portfolio_directory ORDER BY portfolio_id",
  );

  assert.equal(directory.rowCount, 4, "expected exactly four institutional portfolios");

  const ids = new Set(directory.rows.map((row) => row.portfolio_id));
  for (const required of [
    "PORT-ATLAS-GOLDEN-KSA",
    "PORT-ARTAR-KSA",
    "PORT-AJLAN-MINING-KSA",
    "PORT-SGR-KSA",
  ]) {
    assert.ok(ids.has(required), `missing portfolio ${required}`);
  }

  const accounts = await client.query(
    `SELECT account_id, external_subject, iam_binding_status, status
       FROM qassas_security.institution_account
       ORDER BY account_id`,
  );
  assert.equal(accounts.rowCount, 4, "expected four institutional accounts");
  for (const row of accounts.rows) {
    assert.equal(row.external_subject, null, `${row.account_id} must not use a fabricated IdP subject`);
    assert.equal(row.iam_binding_status, "PENDING_IDP_LINK");
    assert.equal(row.status, "PROVISIONED");
  }

  const coverage = await client.query(
    `SELECT portfolio_id,
            count(*)::int AS source_count,
            count(*) FILTER (WHERE access_status = 'AVAILABLE')::int AS available_count,
            count(*) FILTER (WHERE access_status = 'TERM_SHEET_REQUIRED')::int AS term_sheet_count
       FROM qassas_core.portfolio_data_source
       GROUP BY portfolio_id
       ORDER BY portfolio_id`,
  );
  assert.equal(coverage.rowCount, 4);
  for (const row of coverage.rows) {
    assert.equal(row.source_count, 3, `${row.portfolio_id} must have 3 source contracts`);
    assert.equal(row.available_count, 2, `${row.portfolio_id} must have NGD + Taadeen public feeds`);
    assert.equal(row.term_sheet_count, 1, `${row.portfolio_id} must gate private partner data by Term Sheet`);
  }

  const knownCounts = new Map(
    directory.rows.map((row) => [row.portfolio_id, row.public_asset_count]),
  );
  assert.equal(Number(knownCounts.get("PORT-ARTAR-KSA")), 8);
  assert.equal(Number(knownCounts.get("PORT-AJLAN-MINING-KSA")), 38);
  assert.equal(knownCounts.get("PORT-ATLAS-GOLDEN-KSA"), null);
  assert.equal(knownCounts.get("PORT-SGR-KSA"), null);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        institutions: 4,
        portfolios: 4,
        institutional_accounts: 4,
        public_sources_per_portfolio: 2,
        private_sources_per_portfolio: 1,
        fabricated_idp_subjects: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
