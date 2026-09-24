import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";

interface PipelineStatusRow {
  portfolio_id: string;
  institution_id: string;
  enterprise_id: string;
  source_id: string;
  source_name: string;
  source_authority: string;
  source_class: string;
  access_basis: string;
  access_status: string;
  agreement_id: string | null;
  allowed_domains: string[];
  connector_status: string;
  connection_id: string | null;
  connection_status: string | null;
  connection_activated_at: Date | null;
  adapter_count: number;
  adapter_states: unknown;
  latest_ingestion_run_id: string | null;
  latest_ingestion_status: string | null;
  latest_ingestion_started_at: Date | null;
  latest_ingestion_completed_at: Date | null;
  latest_record_count: number | null;
  latest_accepted_count: number | null;
  latest_rejected_count: number | null;
  latest_agreement_id_snapshot: string | null;
  latest_allowed_domains_snapshot: string[];
}

interface RunRow {
  ingestion_run_id: string;
  portfolio_id: string;
  source_id: string;
  status: string;
}

interface AssetRow {
  asset_id: string;
  portfolio_id: string;
  enterprise_id: string;
  asset_name: string;
  asset_type: string;
  external_licence_number: string | null;
  region: string | null;
  area_km2: string | null;
  mineral_classes: string[];
  source_of_record_id: string | null;
  source_object_id: string | null;
  master_data_status: string;
  security_class: string;
  public_data_last_seen_at: Date | null;
}

type IngestionRecordInput = {
  source_object_id?: string;
  source_object_type?: string;
  source_version?: string | null;
  source_updated_at?: string | null;
  retrieved_at?: string;
  payload_hash?: string;
  normalized_object_type?: string | null;
  normalized_object_id?: string | null;
  validation_status?: "RECEIVED" | "NORMALIZED" | "ACCEPTED" | "QUARANTINED" | "REJECTED";
  data_domain?: string | null;
  security_class?: string;
  provenance?: Record<string, unknown>;
};

type AssetDiscoveryInput = {
  portfolio_id?: string;
  source_id?: string;
  source_object_id?: string;
  asset_name?: string;
  asset_type?:
    | "RECONNAISSANCE_LICENCE"
    | "EXPLORATION_LICENCE"
    | "EXPLOITATION_LICENCE"
    | "MINING_LICENCE"
    | "PROJECT"
    | "PROSPECT"
    | "MINERAL_OCCURRENCE"
    | "UNKNOWN";
  external_licence_number?: string | null;
  region?: string | null;
  area_km2?: number | null;
  mineral_classes?: string[];
  geometry_geojson?: Record<string, unknown> | null;
  public_data_last_seen_at?: string | null;
};

@Injectable()
export class DataPipelineService {
  constructor(private readonly database: DatabaseService) {}

  async portfolioStatus(portfolioId: string, actor: AuthenticatedActor) {
    await this.assertPortfolioAccess(portfolioId, actor);

    const result = await this.database.query<PipelineStatusRow>(
      `SELECT *
         FROM qassas_core.portfolio_data_pipeline_status
        WHERE portfolio_id = $1
        ORDER BY source_id`,
      [portfolioId],
    );

    return {
      interface: "PORTFOLIO_DATA_PIPELINE_STATUS",
      portfolio_id: portfolioId,
      automated_decision_authority: false,
      public_data_may_create_targets: false,
      source_count: result.rowCount,
      sources: result.rows.map((row) => ({
        source_id: row.source_id,
        source_name: row.source_name,
        authority: row.source_authority,
        source_class: row.source_class,
        access_basis: row.access_basis,
        access_status: row.access_status,
        agreement_id: row.agreement_id,
        allowed_domains: row.allowed_domains ?? [],
        connector_status: row.connector_status,
        connection: row.connection_id
          ? {
              connection_id: row.connection_id,
              status: row.connection_status,
              activated_at: row.connection_activated_at?.toISOString() ?? null,
            }
          : null,
        adapter_count: Number(row.adapter_count ?? 0),
        adapters: row.adapter_states ?? [],
        latest_run: row.latest_ingestion_run_id
          ? {
              ingestion_run_id: row.latest_ingestion_run_id,
              status: row.latest_ingestion_status,
              started_at: row.latest_ingestion_started_at?.toISOString() ?? null,
              completed_at: row.latest_ingestion_completed_at?.toISOString() ?? null,
              record_count: Number(row.latest_record_count ?? 0),
              accepted_count: Number(row.latest_accepted_count ?? 0),
              rejected_count: Number(row.latest_rejected_count ?? 0),
              agreement_id_snapshot: row.latest_agreement_id_snapshot,
              allowed_domains_snapshot:
                row.latest_allowed_domains_snapshot ?? [],
            }
          : null,
      })),
    };
  }

  async startRun(
    actor: AuthenticatedActor,
    input: {
      portfolio_id?: string;
      source_id?: string;
      trigger_type?: "SCHEDULED" | "MANUAL" | "SOURCE_CHANGE" | "PARTNER_DELIVERY";
      source_snapshot_ref?: string | null;
    },
    correlationId: string,
  ) {
    this.requirePipelineOperator(actor);

    const portfolioId = input.portfolio_id?.trim();
    const sourceId = input.source_id?.trim();
    const triggerType = input.trigger_type ?? "MANUAL";

    if (!portfolioId || !sourceId) {
      throw new BadRequestException("portfolio_id and source_id are required");
    }

    const runId = `ING-${randomUUID()}`;

    try {
      const result = await this.database.query<{
        ingestion_run_id: string;
        portfolio_id: string;
        source_id: string;
        trigger_type: string;
        status: string;
        source_class_snapshot: string | null;
        agreement_id_snapshot: string | null;
        allowed_domains_snapshot: string[];
        started_at: Date;
      }>(
        `INSERT INTO qassas_core.source_ingestion_run (
           ingestion_run_id, portfolio_id, source_id, trigger_type,
           source_snapshot_ref, requested_by_user_id, correlation_id, status
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,'STARTED')
         RETURNING ingestion_run_id, portfolio_id, source_id, trigger_type, status,
                   source_class_snapshot, agreement_id_snapshot,
                   allowed_domains_snapshot, started_at`,
        [
          runId,
          portfolioId,
          sourceId,
          triggerType,
          input.source_snapshot_ref ?? null,
          actor.userId,
          correlationId,
        ],
      );

      return {
        ...result.rows[0],
        started_at: result.rows[0].started_at.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "ingestion run rejected";
      throw new BadRequestException(message);
    }
  }

  async appendRecords(
    actor: AuthenticatedActor,
    runId: string,
    records: IngestionRecordInput[],
  ) {
    this.requirePipelineOperator(actor);

    if (!Array.isArray(records) || records.length === 0 || records.length > 500) {
      throw new BadRequestException("records must contain 1..500 entries");
    }

    const run = await this.findStartedRun(runId);

    try {
      await this.database.transaction(async (client) => {
      for (const record of records) {
        const sourceObjectId = record.source_object_id?.trim();
        const sourceObjectType = record.source_object_type?.trim();
        const payloadHash = record.payload_hash?.trim().toLowerCase();
        const dataDomain = record.data_domain?.trim().toUpperCase() || null;
        const retrievedAt = record.retrieved_at
          ? new Date(record.retrieved_at)
          : new Date();

        if (!sourceObjectId || !sourceObjectType) {
          throw new BadRequestException(
            "source_object_id and source_object_type are required",
          );
        }
        if (!payloadHash || !/^[a-f0-9]{64}$/.test(payloadHash)) {
          throw new BadRequestException(
            "payload_hash must be a SHA-256 hex digest",
          );
        }
        if (Number.isNaN(retrievedAt.getTime())) {
          throw new BadRequestException("retrieved_at must be an ISO timestamp");
        }

        await client.query(
          `INSERT INTO qassas_core.source_ingestion_record (
             ingestion_record_id, ingestion_run_id, source_object_id,
             source_object_type, source_version, source_updated_at,
             retrieved_at, payload_hash, normalized_object_type,
             normalized_object_id, validation_status, data_domain,
             security_class, provenance
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
           ON CONFLICT (ingestion_run_id, source_object_id, payload_hash)
           DO NOTHING`,
          [
            `IR-${randomUUID()}`,
            run.ingestion_run_id,
            sourceObjectId,
            sourceObjectType,
            record.source_version ?? null,
            record.source_updated_at ?? null,
            retrievedAt.toISOString(),
            payloadHash,
            record.normalized_object_type ?? null,
            record.normalized_object_id ?? null,
            record.validation_status ?? "RECEIVED",
            dataDomain,
            record.security_class ?? "C0_PUBLIC",
            JSON.stringify(record.provenance ?? {}),
          ],
        );
      }

      await client.query(
        `UPDATE qassas_core.source_ingestion_run r
            SET record_count = x.record_count,
                accepted_count = x.accepted_count,
                rejected_count = x.rejected_count
           FROM (
             SELECT
               count(*)::int AS record_count,
               count(*) FILTER (WHERE validation_status IN ('NORMALIZED','ACCEPTED'))::int AS accepted_count,
               count(*) FILTER (WHERE validation_status IN ('QUARANTINED','REJECTED'))::int AS rejected_count
             FROM qassas_core.source_ingestion_record
             WHERE ingestion_run_id = $1
           ) x
          WHERE r.ingestion_run_id = $1`,
        [runId],
      );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ingestion record rejected";
      throw new BadRequestException(message);
    }

    return this.runSummary(runId);
  }

  async completeRun(
    actor: AuthenticatedActor,
    runId: string,
    manifestHash?: string | null,
  ) {
    this.requirePipelineOperator(actor);
    await this.findStartedRun(runId);

    if (manifestHash && !/^[a-fA-F0-9]{64}$/.test(manifestHash)) {
      throw new BadRequestException(
        "content_manifest_hash must be a SHA-256 hex digest",
      );
    }

    const result = await this.database.query(
      `UPDATE qassas_core.source_ingestion_run
          SET status = 'COMPLETED',
              completed_at = now(),
              content_manifest_hash = $2
        WHERE ingestion_run_id = $1
          AND status = 'STARTED'
        RETURNING ingestion_run_id`,
      [runId, manifestHash?.toLowerCase() ?? null],
    );

    if (!result.rowCount) throw new NotFoundException();
    return this.runSummary(runId);
  }

  async discoverAsset(actor: AuthenticatedActor, input: AssetDiscoveryInput) {
    this.requirePipelineOperator(actor);

    const portfolioId = input.portfolio_id?.trim();
    const sourceId = input.source_id?.trim();
    const sourceObjectId = input.source_object_id?.trim();
    const assetName = input.asset_name?.trim();
    const assetType = input.asset_type ?? "UNKNOWN";

    if (!portfolioId || !sourceId || !sourceObjectId || !assetName) {
      throw new BadRequestException(
        "portfolio_id, source_id, source_object_id and asset_name are required",
      );
    }

    const source = await this.database.query<{
      enterprise_id: string;
      source_class: string;
      access_status: string;
    }>(
      `SELECT p.enterprise_id, r.source_class, s.access_status
         FROM qassas_core.institution_portfolio p
         JOIN qassas_core.portfolio_data_source s
           ON s.portfolio_id = p.portfolio_id
         JOIN qassas_core.data_source_registry r
           ON r.source_id = s.source_id
        WHERE p.portfolio_id = $1
          AND s.source_id = $2
        LIMIT 1`,
      [portfolioId, sourceId],
    );

    const sourceRow = source.rows[0];
    if (!sourceRow) throw new NotFoundException();
    if (sourceRow.source_class === "PRIVATE_CONTRACTUAL") {
      throw new BadRequestException(
        "Private partner data must enter through a connected contractual ingestion run",
      );
    }
    if (!["AVAILABLE", "CONNECTED"].includes(sourceRow.access_status)) {
      throw new BadRequestException("Source is not currently available");
    }

    const assetId = this.deterministicAssetId(
      portfolioId,
      sourceId,
      sourceObjectId,
    );
    const geojson = input.geometry_geojson
      ? JSON.stringify(input.geometry_geojson)
      : null;

    await this.database.transaction(async (client) => {
      await client.query(
        `INSERT INTO qassas_core.portfolio_asset_registry (
           asset_id, portfolio_id, enterprise_id, asset_name, asset_type,
           external_licence_number, region, area_km2, geometry,
           mineral_classes, source_of_record_id, source_object_id,
           master_data_status, security_class, public_data_last_seen_at
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           CASE WHEN $9::text IS NULL THEN NULL
                ELSE ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)
           END,
           $10::jsonb,$11,$12,'PUBLIC_VERIFIED','C0_PUBLIC',$13
         )
         ON CONFLICT (portfolio_id, source_of_record_id, source_object_id)
         DO UPDATE SET
           asset_name = EXCLUDED.asset_name,
           asset_type = EXCLUDED.asset_type,
           external_licence_number = EXCLUDED.external_licence_number,
           region = EXCLUDED.region,
           area_km2 = EXCLUDED.area_km2,
           geometry = COALESCE(EXCLUDED.geometry, qassas_core.portfolio_asset_registry.geometry),
           mineral_classes = EXCLUDED.mineral_classes,
           master_data_status = CASE
             WHEN qassas_core.portfolio_asset_registry.master_data_status = 'PARTNER_CONFIRMED'
               THEN 'PARTNER_CONFIRMED'
             ELSE 'PUBLIC_VERIFIED'
           END,
           public_data_last_seen_at = EXCLUDED.public_data_last_seen_at,
           updated_at = now()`,
        [
          assetId,
          portfolioId,
          sourceRow.enterprise_id,
          assetName,
          assetType,
          input.external_licence_number ?? null,
          input.region ?? null,
          input.area_km2 ?? null,
          geojson,
          JSON.stringify(input.mineral_classes ?? []),
          sourceId,
          sourceObjectId,
          input.public_data_last_seen_at ?? new Date().toISOString(),
        ],
      );

      await client.query(
        `INSERT INTO qassas_core.asset_source_identity (
           source_id, source_object_id, asset_id, match_method,
           identity_confidence, last_seen_at
         )
         VALUES ($1,$2,$3,'EXACT_PUBLIC_ID',1,now())
         ON CONFLICT (source_id, source_object_id)
         DO UPDATE SET
           asset_id = EXCLUDED.asset_id,
           match_method = 'EXACT_PUBLIC_ID',
           identity_confidence = 1,
           last_seen_at = now()`,
        [sourceId, sourceObjectId, assetId],
      );
    });

    const result = await this.database.query<AssetRow>(
      `SELECT asset_id, portfolio_id, enterprise_id, asset_name, asset_type,
              external_licence_number, region, area_km2, mineral_classes,
              source_of_record_id, source_object_id, master_data_status,
              security_class, public_data_last_seen_at
         FROM qassas_core.portfolio_asset_registry
        WHERE portfolio_id = $1
          AND source_of_record_id = $2
          AND source_object_id = $3
        LIMIT 1`,
      [portfolioId, sourceId, sourceObjectId],
    );

    return {
      ...this.assetView(result.rows[0]),
      target_created: false,
      decision_created: false,
      required_next_step: "HUMAN_ASSET_REVIEW_BEFORE_TARGET_PROMOTION",
    };
  }

  async listAssets(portfolioId: string, actor: AuthenticatedActor) {
    await this.assertPortfolioAccess(portfolioId, actor);
    const result = await this.database.query<AssetRow>(
      `SELECT asset_id, portfolio_id, enterprise_id, asset_name, asset_type,
              external_licence_number, region, area_km2, mineral_classes,
              source_of_record_id, source_object_id, master_data_status,
              security_class, public_data_last_seen_at
         FROM qassas_core.portfolio_asset_registry
        WHERE portfolio_id = $1
          AND master_data_status <> 'ARCHIVED'
        ORDER BY asset_name, asset_id`,
      [portfolioId],
    );

    return {
      portfolio_id: portfolioId,
      asset_count: result.rowCount,
      assets: result.rows.map((row) => this.assetView(row)),
    };
  }

  private async assertPortfolioAccess(
    portfolioId: string,
    actor: AuthenticatedActor,
  ): Promise<void> {
    if (this.hasRole(actor, "SYSTEM_ADMIN")) return;

    const result = await this.database.query(
      `SELECT 1
         FROM qassas_core.institution_portfolio p
         JOIN qassas_security.institution_member_enterprise_scope s
           ON s.enterprise_id = p.enterprise_id
        WHERE p.portfolio_id = $1
          AND s.user_id = $2
        LIMIT 1`,
      [portfolioId, actor.userId],
    );

    if (!result.rowCount) {
      throw new NotFoundException();
    }
  }

  private requirePipelineOperator(actor: AuthenticatedActor): void {
    if (
      this.hasRole(actor, "SYSTEM_ADMIN") ||
      this.hasRole(actor, "DATA_PIPELINE_OPERATOR")
    ) {
      return;
    }
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

  private async findStartedRun(runId: string): Promise<RunRow> {
    const result = await this.database.query<RunRow>(
      `SELECT ingestion_run_id, portfolio_id, source_id, status
         FROM qassas_core.source_ingestion_run
        WHERE ingestion_run_id = $1
          AND status = 'STARTED'
        LIMIT 1`,
      [runId],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  private async runSummary(runId: string) {
    const result = await this.database.query<{
      ingestion_run_id: string;
      portfolio_id: string;
      source_id: string;
      trigger_type: string;
      status: string;
      record_count: number;
      accepted_count: number;
      rejected_count: number;
      content_manifest_hash: string | null;
      source_class_snapshot: string | null;
      agreement_id_snapshot: string | null;
      allowed_domains_snapshot: string[];
      started_at: Date;
      completed_at: Date | null;
    }>(
      `SELECT ingestion_run_id, portfolio_id, source_id, trigger_type, status,
              record_count, accepted_count, rejected_count,
              content_manifest_hash, source_class_snapshot,
              agreement_id_snapshot, allowed_domains_snapshot,
              started_at, completed_at
         FROM qassas_core.source_ingestion_run
        WHERE ingestion_run_id = $1
        LIMIT 1`,
      [runId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return {
      ...row,
      record_count: Number(row.record_count),
      accepted_count: Number(row.accepted_count),
      rejected_count: Number(row.rejected_count),
      started_at: row.started_at.toISOString(),
      completed_at: row.completed_at?.toISOString() ?? null,
    };
  }

  private deterministicAssetId(
    portfolioId: string,
    sourceId: string,
    sourceObjectId: string,
  ): string {
    const digest = createHash("sha256")
      .update(`${portfolioId}:${sourceId}:${sourceObjectId}`)
      .digest("hex")
      .slice(0, 20)
      .toUpperCase();
    return `AST-${digest}`;
  }

  private assetView(row: AssetRow) {
    return {
      asset_id: row.asset_id,
      portfolio_id: row.portfolio_id,
      enterprise_id: row.enterprise_id,
      asset_name: row.asset_name,
      asset_type: row.asset_type,
      external_licence_number: row.external_licence_number,
      region: row.region,
      area_km2: row.area_km2 === null ? null : Number(row.area_km2),
      mineral_classes: row.mineral_classes ?? [],
      source_of_record_id: row.source_of_record_id,
      source_object_id: row.source_object_id,
      master_data_status: row.master_data_status,
      security_class: row.security_class,
      public_data_last_seen_at:
        row.public_data_last_seen_at?.toISOString() ?? null,
    };
  }
}
