import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import type { AuthenticatedActor } from "../../auth/auth.types";
import { DatabaseService } from "../../database/database.service";
import {
  changedTaadeenFields,
  parseTaadeenLicenceHtml,
  TAADEN_PARSER_VERSION,
  type TaadeenLicenceRecord,
} from "./taadeen-parser";

interface PortfolioContext {
  portfolio_id: string;
  institution_id: string;
  enterprise_id: string;
  source_status: string;
}

interface PreviousSnapshotRow {
  snapshot_id: string;
  normalized_payload_hash: string;
  normalized_payload: TaadeenLicenceRecord;
}

type SyncInput = {
  license_numbers?: string[];
  max_records?: number;
};

type SyncItemResult = {
  license_number: string;
  status: "ACCEPTED" | "QUARANTINED";
  change_type: "FIRST_SEEN" | "CHANGED" | "UNCHANGED" | "QUARANTINED";
  changed_fields: string[];
  asset_id: string | null;
  quarantine_reason: string | null;
  source_updated_at: string | null;
};

@Injectable()
export class TaadeenAdapterService {
  private readonly sourceId = "SRC-TAADEN";
  private readonly adapterId = "ADP-TAADEN-LICENCE-PAGE";

  constructor(private readonly database: DatabaseService) {}

  async status(portfolioId: string, actor: AuthenticatedActor) {
    await this.assertPortfolioAccess(portfolioId, actor);

    const status = await this.database.query<{
      portfolio_id: string;
      institution_id: string;
      enterprise_id: string;
      taadeen_asset_count: number;
      latest_asset_seen_at: Date | null;
      latest_run_id: string | null;
      latest_run_status: string | null;
      latest_run_started_at: Date | null;
      latest_run_completed_at: Date | null;
      latest_record_count: number | null;
      latest_accepted_count: number | null;
      latest_rejected_count: number | null;
      adapter_runtime_status: string | null;
      last_attempt_at: Date | null;
      last_success_at: Date | null;
      last_failure_at: Date | null;
      consecutive_failures: number | null;
      last_error_code: string | null;
      last_error_summary: string | null;
    }>(
      "SELECT * FROM qassas_core.taadeen_portfolio_sync_status WHERE portfolio_id = $1 LIMIT 1",
      [portfolioId],
    );
    if (!status.rows[0]) throw new NotFoundException();

    const changes = await this.database.query<{
      source_object_id: string;
      change_type: string;
      changed_fields: string[];
      created_at: Date;
      snapshot_id: string;
      previous_snapshot_id: string | null;
    }>(
      "SELECT source_object_id, change_type, changed_fields, created_at, snapshot_id, previous_snapshot_id FROM qassas_core.public_source_change_event WHERE portfolio_id = $1 AND source_id = 'SRC-TAADEN' ORDER BY created_at DESC, change_event_id DESC LIMIT 25",
      [portfolioId],
    );

    const row = status.rows[0];
    return {
      interface: "TAADEN_PORTFOLIO_SYNC_STATUS",
      portfolio_id: portfolioId,
      source_id: this.sourceId,
      adapter_id: this.adapterId,
      parser_version: TAADEN_PARSER_VERSION,
      asset_count: Number(row.taadeen_asset_count ?? 0),
      latest_asset_seen_at: row.latest_asset_seen_at?.toISOString() ?? null,
      runtime: {
        status: row.adapter_runtime_status ?? "NEVER_RUN",
        last_attempt_at: row.last_attempt_at?.toISOString() ?? null,
        last_success_at: row.last_success_at?.toISOString() ?? null,
        last_failure_at: row.last_failure_at?.toISOString() ?? null,
        consecutive_failures: Number(row.consecutive_failures ?? 0),
        last_error_code: row.last_error_code,
        last_error_summary: row.last_error_summary,
      },
      latest_run: row.latest_run_id
        ? {
            ingestion_run_id: row.latest_run_id,
            status: row.latest_run_status,
            started_at: row.latest_run_started_at?.toISOString() ?? null,
            completed_at: row.latest_run_completed_at?.toISOString() ?? null,
            record_count: Number(row.latest_record_count ?? 0),
            accepted_count: Number(row.latest_accepted_count ?? 0),
            rejected_count: Number(row.latest_rejected_count ?? 0),
          }
        : null,
      recent_changes: changes.rows.map((change) => ({
        source_object_id: change.source_object_id,
        change_type: change.change_type,
        changed_fields: change.changed_fields ?? [],
        snapshot_id: change.snapshot_id,
        previous_snapshot_id: change.previous_snapshot_id,
        created_at: change.created_at.toISOString(),
      })),
      automated_target_creation: false,
      automated_decision_authority: false,
    };
  }

  async syncPortfolio(
    actor: AuthenticatedActor,
    portfolioId: string,
    input: SyncInput,
    correlationId: string,
  ) {
    this.requirePipelineOperator(actor);
    const context = await this.portfolioContext(portfolioId);

    const limit = Number(input.max_records ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException("max_records must be an integer between 1 and 100");
    }

    const requested = this.normalizeLicenseNumbers(input.license_numbers ?? []);
    const licenseNumbers = requested.length > 0
      ? requested.slice(0, limit)
      : await this.registeredLicenseNumbers(portfolioId, limit);

    if (licenseNumbers.length === 0) {
      throw new BadRequestException(
        "No Taadeen licence numbers are registered for this portfolio; provide license_numbers explicitly",
      );
    }

    const runId = "ING-TAADEN-" + randomUUID();
    const startedAt = new Date();

    await this.database.query(
      "INSERT INTO qassas_core.source_ingestion_run (ingestion_run_id, portfolio_id, source_id, trigger_type, source_snapshot_ref, requested_by_user_id, correlation_id, status) VALUES ($1,$2,$3,'SOURCE_CHANGE',$4,$5,$6,'STARTED')",
      [runId, portfolioId, this.sourceId, "taadeen://portfolio/" + portfolioId, actor.userId, correlationId],
    );
    await this.markRuntimeAttempt(runId, startedAt);

    const results: SyncItemResult[] = [];
    const snapshotHashes: string[] = [];

    try {
      for (const licenseNumber of licenseNumbers) {
        const result = await this.syncLicence(context, runId, licenseNumber, correlationId);
        results.push(result);
        if (result.status === "ACCEPTED") {
          const snapshot = await this.database.query<{ raw_payload_hash: string }>(
            "SELECT raw_payload_hash FROM qassas_core.public_source_snapshot WHERE portfolio_id = $1 AND source_id = 'SRC-TAADEN' AND source_object_id = $2 ORDER BY created_at DESC, snapshot_id DESC LIMIT 1",
            [portfolioId, licenseNumber],
          );
          if (snapshot.rows[0]?.raw_payload_hash) snapshotHashes.push(snapshot.rows[0].raw_payload_hash);
        }
        await this.optionalDelay();
      }

      const accepted = results.filter((item) => item.status === "ACCEPTED").length;
      const quarantined = results.length - accepted;
      const manifestHash = createHash("sha256")
        .update([...snapshotHashes].sort().join(":"))
        .digest("hex");

      await this.database.query(
        "UPDATE qassas_core.source_ingestion_run SET status = 'COMPLETED', completed_at = now(), record_count = $2, accepted_count = $3, rejected_count = $4, content_manifest_hash = $5 WHERE ingestion_run_id = $1",
        [runId, results.length, accepted, quarantined, manifestHash],
      );

      await this.database.query(
        "INSERT INTO qassas_core.source_adapter_runtime_state (adapter_id, runtime_status, last_run_id, last_attempt_at, last_success_at, last_failure_at, consecutive_failures, last_error_code, last_error_summary, updated_at) VALUES ($1,$2,$3,$4,now(),CASE WHEN $5::int > 0 THEN now() ELSE NULL END,CASE WHEN $5::int > 0 THEN 1 ELSE 0 END,CASE WHEN $5::int > 0 THEN 'QUARANTINED_RECORDS' ELSE NULL END,CASE WHEN $5::int > 0 THEN $6 ELSE NULL END,now()) ON CONFLICT (adapter_id) DO UPDATE SET runtime_status = EXCLUDED.runtime_status, last_run_id = EXCLUDED.last_run_id, last_attempt_at = EXCLUDED.last_attempt_at, last_success_at = EXCLUDED.last_success_at, last_failure_at = EXCLUDED.last_failure_at, consecutive_failures = EXCLUDED.consecutive_failures, last_error_code = EXCLUDED.last_error_code, last_error_summary = EXCLUDED.last_error_summary, updated_at = now()",
        [
          this.adapterId,
          quarantined > 0 ? "DEGRADED" : "HEALTHY",
          runId,
          startedAt.toISOString(),
          quarantined,
          quarantined > 0 ? quarantined + " of " + results.length + " records quarantined" : null,
        ],
      );

      return {
        interface: "TAADEN_LIVE_SYNC_RESULT",
        portfolio_id: portfolioId,
        run_id: runId,
        source_id: this.sourceId,
        adapter_id: this.adapterId,
        parser_version: TAADEN_PARSER_VERSION,
        requested_count: licenseNumbers.length,
        accepted_count: accepted,
        quarantined_count: quarantined,
        results,
        target_created_count: 0,
        decision_created_count: 0,
        required_next_step: "HUMAN_ASSET_REVIEW_BEFORE_TARGET_PROMOTION",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Taadeen sync failed";
      await this.database.query(
        "UPDATE qassas_core.source_ingestion_run SET status = 'FAILED', completed_at = now(), error_summary = $2 WHERE ingestion_run_id = $1",
        [runId, message.slice(0, 1000)],
      );
      await this.database.query(
        "INSERT INTO qassas_core.source_adapter_runtime_state (adapter_id, runtime_status, last_run_id, last_attempt_at, last_failure_at, consecutive_failures, last_error_code, last_error_summary, updated_at) VALUES ($1,'UNREACHABLE',$2,$3,now(),1,'SYNC_FAILED',$4,now()) ON CONFLICT (adapter_id) DO UPDATE SET runtime_status = 'UNREACHABLE', last_run_id = EXCLUDED.last_run_id, last_attempt_at = EXCLUDED.last_attempt_at, last_failure_at = now(), consecutive_failures = qassas_core.source_adapter_runtime_state.consecutive_failures + 1, last_error_code = 'SYNC_FAILED', last_error_summary = EXCLUDED.last_error_summary, updated_at = now()",
        [this.adapterId, runId, startedAt.toISOString(), message.slice(0, 1000)],
      );
      throw new BadRequestException(message);
    }
  }

  private async syncLicence(
    context: PortfolioContext,
    runId: string,
    licenseNumber: string,
    correlationId: string,
  ): Promise<SyncItemResult> {
    const sourceUrl = this.licenseUrl(licenseNumber);
    const retrievedAt = new Date();
    let response: Response;
    let html = "";

    try {
      response = await fetch(sourceUrl, {
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "QASSAS-Public-Regulatory-Adapter/0.1",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
      html = await response.text();
    } catch (error) {
      return this.quarantine(
        context, runId, licenseNumber, sourceUrl, retrievedAt, 599, "",
        "TAADEN_FETCH_FAILED",
        error instanceof Error ? error.message : "fetch failed",
        correlationId,
      );
    }

    const maxBytes = this.maxPayloadBytes();
    if (Buffer.byteLength(html, "utf8") > maxBytes) {
      return this.quarantine(
        context, runId, licenseNumber, sourceUrl, retrievedAt, response.status,
        html.slice(0, maxBytes), "TAADEN_PAYLOAD_TOO_LARGE",
        "payload exceeds " + maxBytes + " bytes", correlationId,
      );
    }

    if (!response.ok) {
      return this.quarantine(
        context, runId, licenseNumber, sourceUrl, retrievedAt, response.status, html,
        "TAADEN_HTTP_" + response.status,
        "Taadeen returned HTTP " + response.status,
        correlationId,
      );
    }

    const parsed = parseTaadeenLicenceHtml(html, licenseNumber);
    if (!parsed.ok || !parsed.record || !parsed.normalized_hash) {
      return this.quarantine(
        context, runId, licenseNumber, sourceUrl, retrievedAt, response.status, html,
        "TAADEN_SCHEMA_DRIFT",
        [...parsed.errors, ...parsed.warnings].join(", ") || "unrecognized Taadeen record",
        correlationId,
      );
    }

    const record = parsed.record;
    const normalizedHash = parsed.normalized_hash;
    const rawPayloadHash = createHash("sha256").update(html).digest("hex");
    const previous = await this.previousAcceptedSnapshot(context.portfolio_id, licenseNumber);
    const changedFields = changedTaadeenFields(previous?.normalized_payload ?? null, record);
    const changeType: SyncItemResult["change_type"] = !previous
      ? "FIRST_SEEN"
      : previous.normalized_payload_hash === normalizedHash
        ? "UNCHANGED"
        : "CHANGED";

    const snapshotId = "PSS-" + randomUUID();
    const assetId = this.deterministicAssetId(context.portfolio_id, licenseNumber);

    await this.database.transaction(async (client) => {
      await client.query(
        "INSERT INTO qassas_core.public_source_snapshot (snapshot_id, portfolio_id, source_id, adapter_id, source_object_id, source_url, parser_version, source_updated_at, retrieved_at, http_status, raw_payload_hash, normalized_payload_hash, normalized_payload, validation_status) VALUES ($1,$2,'SRC-TAADEN','ADP-TAADEN-LICENCE-PAGE',$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'ACCEPTED')",
        [
          snapshotId, context.portfolio_id, licenseNumber, sourceUrl,
          TAADEN_PARSER_VERSION, record.source_updated_at,
          retrievedAt.toISOString(), response.status, rawPayloadHash,
          normalizedHash, JSON.stringify(record),
        ],
      );

      await client.query(
        "INSERT INTO qassas_core.source_ingestion_record (ingestion_record_id, ingestion_run_id, source_object_id, source_object_type, source_version, source_updated_at, retrieved_at, payload_hash, normalized_object_type, normalized_object_id, validation_status, data_domain, security_class, provenance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PORTFOLIO_ASSET',$9,'ACCEPTED','LICENCES','C0_PUBLIC',$10::jsonb)",
        [
          "IR-" + randomUUID(), runId, licenseNumber, record.asset_type,
          TAADEN_PARSER_VERSION, record.source_updated_at,
          retrievedAt.toISOString(), rawPayloadHash, assetId,
          JSON.stringify({
            source_url: sourceUrl,
            source_authority: "Ministry of Industry and Mineral Resources",
            adapter_id: this.adapterId,
            parser_version: TAADEN_PARSER_VERSION,
            snapshot_id: snapshotId,
            normalized_payload_hash: normalizedHash,
            warnings: parsed.warnings,
            correlation_id: correlationId,
          }),
        ],
      );

      await this.upsertAsset(client, context, assetId, record, retrievedAt);

      await client.query(
        "INSERT INTO qassas_core.public_source_change_event (change_event_id, portfolio_id, source_id, adapter_id, source_object_id, snapshot_id, previous_snapshot_id, change_type, changed_fields) VALUES ($1,$2,'SRC-TAADEN','ADP-TAADEN-LICENCE-PAGE',$3,$4,$5,$6,$7::jsonb)",
        [
          "PSCE-" + randomUUID(), context.portfolio_id, licenseNumber,
          snapshotId, previous?.snapshot_id ?? null, changeType,
          JSON.stringify(changedFields),
        ],
      );
    });

    return {
      license_number: licenseNumber,
      status: "ACCEPTED",
      change_type: changeType,
      changed_fields: changedFields,
      asset_id: assetId,
      quarantine_reason: null,
      source_updated_at: record.source_updated_at,
    };
  }

  private async quarantine(
    context: PortfolioContext,
    runId: string,
    licenseNumber: string,
    sourceUrl: string,
    retrievedAt: Date,
    httpStatus: number,
    html: string,
    code: string,
    detail: string,
    correlationId: string,
  ): Promise<SyncItemResult> {
    const rawPayloadHash = createHash("sha256").update(html).digest("hex");
    const snapshotId = "PSS-" + randomUUID();
    const reason = (code + ": " + detail).slice(0, 1000);

    await this.database.transaction(async (client) => {
      await client.query(
        "INSERT INTO qassas_core.public_source_snapshot (snapshot_id, portfolio_id, source_id, adapter_id, source_object_id, source_url, parser_version, retrieved_at, http_status, raw_payload_hash, validation_status, quarantine_reason) VALUES ($1,$2,'SRC-TAADEN','ADP-TAADEN-LICENCE-PAGE',$3,$4,$5,$6,$7,$8,'QUARANTINED',$9)",
        [
          snapshotId, context.portfolio_id, licenseNumber, sourceUrl,
          TAADEN_PARSER_VERSION, retrievedAt.toISOString(), httpStatus,
          rawPayloadHash, reason,
        ],
      );

      await client.query(
        "INSERT INTO qassas_core.source_ingestion_record (ingestion_record_id, ingestion_run_id, source_object_id, source_object_type, source_version, retrieved_at, payload_hash, validation_status, data_domain, security_class, provenance) VALUES ($1,$2,$3,'TAADEN_PUBLIC_RECORD',$4,$5,$6,'QUARANTINED','LICENCES','C0_PUBLIC',$7::jsonb)",
        [
          "IR-" + randomUUID(), runId, licenseNumber, TAADEN_PARSER_VERSION,
          retrievedAt.toISOString(), rawPayloadHash,
          JSON.stringify({
            source_url: sourceUrl,
            source_authority: "Ministry of Industry and Mineral Resources",
            adapter_id: this.adapterId,
            parser_version: TAADEN_PARSER_VERSION,
            quarantine_code: code,
            quarantine_reason: reason,
            snapshot_id: snapshotId,
            correlation_id: correlationId,
          }),
        ],
      );

      await client.query(
        "INSERT INTO qassas_core.public_source_change_event (change_event_id, portfolio_id, source_id, adapter_id, source_object_id, snapshot_id, change_type, changed_fields) VALUES ($1,$2,'SRC-TAADEN','ADP-TAADEN-LICENCE-PAGE',$3,$4,'QUARANTINED','[]'::jsonb)",
        ["PSCE-" + randomUUID(), context.portfolio_id, licenseNumber, snapshotId],
      );
    });

    return {
      license_number: licenseNumber,
      status: "QUARANTINED",
      change_type: "QUARANTINED",
      changed_fields: [],
      asset_id: null,
      quarantine_reason: reason,
      source_updated_at: null,
    };
  }

  private async upsertAsset(
    client: PoolClient,
    context: PortfolioContext,
    assetId: string,
    record: TaadeenLicenceRecord,
    retrievedAt: Date,
  ) {
    const assetName = record.investor_name
      ? record.investor_name + " — Licence " + record.license_number
      : "Taadeen Licence " + record.license_number;
    const geometry = record.geometry_geojson ? JSON.stringify(record.geometry_geojson) : null;

    await client.query(
      "INSERT INTO qassas_core.portfolio_asset_registry (asset_id, portfolio_id, enterprise_id, asset_name, asset_type, external_licence_number, region, area_km2, geometry, mineral_classes, source_of_record_id, source_object_id, master_data_status, security_class, public_data_last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $9::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($9),4326) END,$10::jsonb,'SRC-TAADEN',$11,'PUBLIC_VERIFIED','C0_PUBLIC',$12) ON CONFLICT (portfolio_id, source_of_record_id, source_object_id) DO UPDATE SET asset_name = CASE WHEN qassas_core.portfolio_asset_registry.master_data_status = 'PARTNER_CONFIRMED' THEN qassas_core.portfolio_asset_registry.asset_name ELSE EXCLUDED.asset_name END, asset_type = EXCLUDED.asset_type, external_licence_number = EXCLUDED.external_licence_number, region = EXCLUDED.region, area_km2 = EXCLUDED.area_km2, geometry = COALESCE(EXCLUDED.geometry,qassas_core.portfolio_asset_registry.geometry), mineral_classes = EXCLUDED.mineral_classes, master_data_status = CASE WHEN qassas_core.portfolio_asset_registry.master_data_status = 'PARTNER_CONFIRMED' THEN 'PARTNER_CONFIRMED' ELSE 'PUBLIC_VERIFIED' END, public_data_last_seen_at = EXCLUDED.public_data_last_seen_at, updated_at = now()",
      [
        assetId, context.portfolio_id, context.enterprise_id, assetName,
        record.asset_type, record.license_number, record.region,
        record.total_area_km2, geometry,
        JSON.stringify(record.mineral_class ? [record.mineral_class] : []),
        record.license_number, retrievedAt.toISOString(),
      ],
    );

    await client.query(
      "INSERT INTO qassas_core.asset_source_identity (source_id, source_object_id, asset_id, match_method, identity_confidence, last_seen_at) VALUES ('SRC-TAADEN',$1,$2,'EXACT_PUBLIC_ID',1,$3) ON CONFLICT (source_id, source_object_id) DO UPDATE SET asset_id = EXCLUDED.asset_id, match_method = 'EXACT_PUBLIC_ID', identity_confidence = 1, last_seen_at = EXCLUDED.last_seen_at",
      [record.license_number, assetId, retrievedAt.toISOString()],
    );
  }

  private async previousAcceptedSnapshot(
    portfolioId: string,
    licenseNumber: string,
  ): Promise<PreviousSnapshotRow | null> {
    const result = await this.database.query<PreviousSnapshotRow>(
      "SELECT snapshot_id, normalized_payload_hash, normalized_payload FROM qassas_core.public_source_snapshot WHERE portfolio_id = $1 AND source_id = 'SRC-TAADEN' AND source_object_id = $2 AND validation_status = 'ACCEPTED' ORDER BY created_at DESC, snapshot_id DESC LIMIT 1",
      [portfolioId, licenseNumber],
    );
    return result.rows[0] ?? null;
  }

  private async portfolioContext(portfolioId: string): Promise<PortfolioContext> {
    const result = await this.database.query<PortfolioContext>(
      "SELECT p.portfolio_id, p.institution_id, p.enterprise_id, s.access_status AS source_status FROM qassas_core.institution_portfolio p JOIN qassas_core.portfolio_data_source s ON s.portfolio_id = p.portfolio_id AND s.source_id = 'SRC-TAADEN' WHERE p.portfolio_id = $1 LIMIT 1",
      [portfolioId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    if (!["AVAILABLE", "CONNECTED"].includes(row.source_status)) {
      throw new BadRequestException("Taadeen public source is not available");
    }
    return row;
  }

  private async registeredLicenseNumbers(portfolioId: string, limit: number): Promise<string[]> {
    const result = await this.database.query<{ source_object_id: string }>(
      "SELECT source_object_id FROM qassas_core.portfolio_asset_registry WHERE portfolio_id = $1 AND source_of_record_id = 'SRC-TAADEN' AND source_object_id IS NOT NULL AND master_data_status <> 'ARCHIVED' ORDER BY source_object_id LIMIT $2",
      [portfolioId, limit],
    );
    return result.rows.map((row) => row.source_object_id);
  }

  private normalizeLicenseNumbers(values: string[]): string[] {
    const clean = values
      .map((value) => String(value).trim())
      .filter((value) => /^[A-Za-z0-9-]{3,40}$/.test(value));
    if (clean.length !== values.length) {
      throw new BadRequestException(
        "license_numbers contains an invalid public licence identifier",
      );
    }
    return [...new Set(clean)];
  }

  private licenseUrl(licenseNumber: string): string {
    return new URL(
      "/en/mining-info/licenses/" + encodeURIComponent(licenseNumber),
      this.taadeenBaseUrl(),
    ).toString();
  }

  private taadeenBaseUrl(): string {
    const environment = process.env.QASSAS_ENVIRONMENT ?? "local";
    const configured = process.env.TAADEN_BASE_URL?.trim();

    if (configured && ["local", "test"].includes(environment)) {
      const url = new URL(configured);
      if (
        url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
      ) {
        throw new BadRequestException(
          "TAADEN_BASE_URL must use HTTPS or local test HTTP",
        );
      }
      return url.toString();
    }

    return "https://taadeen.sa/";
  }

  private timeoutMs(): number {
    const value = Number(process.env.TAADEN_HTTP_TIMEOUT_MS ?? 10000);
    return Number.isFinite(value) ? Math.min(Math.max(value, 1000), 30000) : 10000;
  }

  private maxPayloadBytes(): number {
    const value = Number(process.env.TAADEN_MAX_PAYLOAD_BYTES ?? 2000000);
    return Number.isFinite(value)
      ? Math.min(Math.max(value, 100000), 5000000)
      : 2000000;
  }

  private async optionalDelay(): Promise<void> {
    const value = Number(process.env.TAADEN_REQUEST_DELAY_MS ?? 250);
    const delay = Number.isFinite(value) ? Math.min(Math.max(value, 0), 2000) : 250;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private deterministicAssetId(portfolioId: string, licenseNumber: string): string {
    return "AST-" + createHash("sha256")
      .update(portfolioId + "|SRC-TAADEN|" + licenseNumber)
      .digest("hex")
      .slice(0, 24)
      .toUpperCase();
  }

  private async markRuntimeAttempt(runId: string, at: Date) {
    await this.database.query(
      "INSERT INTO qassas_core.source_adapter_runtime_state (adapter_id, runtime_status, last_run_id, last_attempt_at, consecutive_failures, updated_at) VALUES ($1,'NEVER_RUN',$2,$3,0,now()) ON CONFLICT (adapter_id) DO UPDATE SET last_run_id = EXCLUDED.last_run_id, last_attempt_at = EXCLUDED.last_attempt_at, updated_at = now()",
      [this.adapterId, runId, at.toISOString()],
    );
  }

  private async assertPortfolioAccess(portfolioId: string, actor: AuthenticatedActor) {
    if (this.hasRole(actor, "SYSTEM_ADMIN")) return;
    const result = await this.database.query(
      "SELECT 1 FROM qassas_core.institution_portfolio p JOIN qassas_security.institution_member_enterprise_scope s ON s.enterprise_id = p.enterprise_id WHERE p.portfolio_id = $1 AND s.user_id = $2 LIMIT 1",
      [portfolioId, actor.userId],
    );
    if (!result.rowCount) throw new NotFoundException();
  }

  private requirePipelineOperator(actor: AuthenticatedActor) {
    if (
      this.hasRole(actor, "SYSTEM_ADMIN") ||
      this.hasRole(actor, "DATA_PIPELINE_OPERATOR")
    ) return;
    throw new ForbiddenException("Data pipeline operator role required");
  }

  private hasRole(actor: AuthenticatedActor, roleType: string): boolean {
    const now = Date.now();
    return actor.roleAssignments.some((role) => {
      if (role.roleType !== roleType || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
  }
}
