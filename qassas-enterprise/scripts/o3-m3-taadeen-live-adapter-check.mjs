import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseService } from "../apps/qassas-api/dist/database/database.service.js";
import { TaadeenAdapterService } from "../apps/qassas-api/dist/public-sources/taadeen/taadeen-adapter.service.js";
import {
  parseTaadeenLicenceHtml,
  TAADEN_PARSER_VERSION,
} from "../apps/qassas-api/dist/public-sources/taadeen/taadeen-parser.js";

process.env.QASSAS_ENVIRONMENT = "test";
process.env.TAADEN_REQUEST_DELAY_MS = "0";
process.env.TAADEN_HTTP_TIMEOUT_MS = "2000";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(
  path.join(here, "fixtures", "taadeen-license-14443129.html"),
  "utf8",
);

const parsed = parseTaadeenLicenceHtml(fixture, "14443129");
assert.equal(parsed.ok, true);
assert.equal(parsed.record?.license_number, "14443129");
assert.equal(parsed.record?.asset_type, "EXPLORATION_LICENCE");
assert.equal(parsed.record?.total_area_km2, 100);
assert.equal(parsed.record?.region, "Riyadh");
assert.equal(parsed.record?.mineral_class, "CLASS_A");
assert.equal(parsed.record?.unified_number, "7032181559");
assert.equal(parsed.record?.cr_number, "1010846366");
assert.equal(parsed.record?.coordinates.length, 6);
assert.equal(parsed.record?.geometry_geojson?.type, "Polygon");
assert.equal(parsed.record?.geometry_geojson?.coordinates[0].length, 7);
assert.equal(parsed.record?.source_updated_at, "2026-09-14T18:35:00.000Z");
assert.equal(TAADEN_PARSER_VERSION, "TAADEN_HTML_V1");

const db = new DatabaseService();
const service = new TaadeenAdapterService(db);

const actor = {
  userId: "USR-E2E-ARTAR",
  externalSubject: "m3-system-admin-ci",
  roleAssignments: [
    {
      roleAssignmentId: "RA-M3-SYSTEM-ADMIN",
      roleType: "SYSTEM_ADMIN",
      assetScope: [],
      jvScope: [],
      decisionClassScope: [],
      capitalThreshold: null,
      securityClearance: "C3_RESTRICTED",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      status: "ACTIVE",
    },
  ],
  claims: {},
};

let currentHtml = fixture;
globalThis.fetch = async () =>
  new Response(currentHtml, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

try {
  const first = await service.syncPortfolio(
    actor,
    "PORT-AJLAN-MINING-KSA",
    { license_numbers: ["14443129"], max_records: 1 },
    "CORR-M3-FIRST-SEEN",
  );
  assert.equal(first.accepted_count, 1);
  assert.equal(first.quarantined_count, 0);
  assert.equal(first.results[0].change_type, "FIRST_SEEN");
  assert.equal(first.target_created_count, 0);
  assert.equal(first.decision_created_count, 0);

  const unchanged = await service.syncPortfolio(
    actor,
    "PORT-AJLAN-MINING-KSA",
    { license_numbers: ["14443129"], max_records: 1 },
    "CORR-M3-UNCHANGED",
  );
  assert.equal(unchanged.results[0].change_type, "UNCHANGED");

  currentHtml = fixture
    .replaceAll("100.00 km²", "99.50 km²")
    .replace(
      "14/09/2026 - 09:35 PM",
      "25/09/2026 - 07:00 AM",
    );

  const changed = await service.syncPortfolio(
    actor,
    "PORT-AJLAN-MINING-KSA",
    { license_numbers: ["14443129"], max_records: 1 },
    "CORR-M3-CHANGED",
  );
  assert.equal(changed.results[0].change_type, "CHANGED");
  assert.ok(changed.results[0].changed_fields.includes("total_area_km2"));
  assert.ok(changed.results[0].changed_fields.includes("source_updated_at"));

  const asset = await db.query(
    "SELECT asset_id, area_km2, region, mineral_classes, master_data_status FROM qassas_core.portfolio_asset_registry WHERE portfolio_id = 'PORT-AJLAN-MINING-KSA' AND source_of_record_id = 'SRC-TAADEN' AND source_object_id = '14443129'",
  );
  assert.equal(asset.rowCount, 1);
  assert.equal(Number(asset.rows[0].area_km2), 99.5);
  assert.equal(asset.rows[0].region, "Riyadh");
  assert.deepEqual(asset.rows[0].mineral_classes, ["CLASS_A"]);
  assert.equal(asset.rows[0].master_data_status, "PUBLIC_VERIFIED");

  currentHtml = "<html><body><h1>Taadeen layout changed</h1></body></html>";
  const quarantined = await service.syncPortfolio(
    actor,
    "PORT-AJLAN-MINING-KSA",
    { license_numbers: ["14443129"], max_records: 1 },
    "CORR-M3-QUARANTINE",
  );
  assert.equal(quarantined.accepted_count, 0);
  assert.equal(quarantined.quarantined_count, 1);
  assert.equal(quarantined.results[0].change_type, "QUARANTINED");
  assert.match(
    quarantined.results[0].quarantine_reason,
    /TAADEN_SCHEMA_DRIFT/,
  );

  const assetAfterQuarantine = await db.query(
    "SELECT area_km2 FROM qassas_core.portfolio_asset_registry WHERE portfolio_id = 'PORT-AJLAN-MINING-KSA' AND source_of_record_id = 'SRC-TAADEN' AND source_object_id = '14443129'",
  );
  assert.equal(Number(assetAfterQuarantine.rows[0].area_km2), 99.5);

  const target = await db.query(
    "SELECT count(*)::int AS count FROM qassas_core.target WHERE asset_id = $1",
    [asset.rows[0].asset_id],
  );
  assert.equal(target.rows[0].count, 0);

  const events = await db.query(
    "SELECT change_type FROM qassas_core.public_source_change_event WHERE portfolio_id = 'PORT-AJLAN-MINING-KSA' AND source_object_id = '14443129' ORDER BY created_at, change_event_id",
  );
  assert.deepEqual(
    events.rows.map((row) => row.change_type),
    ["FIRST_SEEN", "UNCHANGED", "CHANGED", "QUARANTINED"],
  );

  const snapshots = await db.query(
    "SELECT validation_status, count(*)::int AS count FROM qassas_core.public_source_snapshot WHERE portfolio_id = 'PORT-AJLAN-MINING-KSA' AND source_object_id = '14443129' GROUP BY validation_status ORDER BY validation_status",
  );
  assert.deepEqual(snapshots.rows, [
    { validation_status: "ACCEPTED", count: 3 },
    { validation_status: "QUARANTINED", count: 1 },
  ]);

  const runtime = await service.status("PORT-AJLAN-MINING-KSA", actor);
  assert.equal(runtime.runtime.status, "DEGRADED");
  assert.equal(runtime.latest_run.rejected_count, 1);
  assert.equal(runtime.automated_target_creation, false);
  assert.equal(runtime.automated_decision_authority, false);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        parser: TAADEN_PARSER_VERSION,
        live_adapter_path: "FETCH_PARSE_VALIDATE_GOVERNED_COMMIT",
        first_seen: "PASS",
        unchanged_detection: "PASS",
        changed_detection: "PASS",
        schema_drift_quarantine: "PASS",
        last_good_asset_preserved: "PASS",
        provenance_snapshots: 4,
        automated_target_creation: false,
        automated_decision_authority: false,
      },
      null,
      2,
    ),
  );
} finally {
  await db.onModuleDestroy();
}
