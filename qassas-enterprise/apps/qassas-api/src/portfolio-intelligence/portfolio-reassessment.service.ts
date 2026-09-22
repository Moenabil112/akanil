import { createHash, randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditEventWriter } from "../audit/audit-event.writer";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import { PortfolioChangeService } from "./portfolio-change.service";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";

interface IdempotencyRow {
  request_hash: string;
  result_payload: Record<string, unknown>;
}

interface SnapshotRow {
  snapshot_id: string;
  enterprise_id: string;
  model_version: string | null;
  trigger_type: string;
  source_event_refs: string[];
  asset_count: number;
  portfolio_state_hash: string;
  snapshot: Record<string, unknown>;
  created_by_user_id: string;
  created_at: Date;
}

@Injectable()
export class PortfolioReassessmentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly intelligence: PortfolioIntelligenceService,
    private readonly changes: PortfolioChangeService,
    private readonly audit: AuditEventWriter,
  ) {}

  async createSnapshot(
    actor: AuthenticatedActor,
    triggerType: string,
    sourceEventRefs: string[],
    idempotencyKey: string,
    correlationId: string,
  ) {
    this.requirePortfolioExecutive(actor);

    const [board, changeFeed] = await Promise.all([
      this.intelligence.controlBoard(actor),
      this.changes.changeFeed(actor),
    ]);

    const enterprise = await this.database.query<{ enterprise_id: string }>(
      "SELECT DISTINCT enterprise_id FROM qassas_core.pilot_asset_profile WHERE pilot_status = 'ACTIVE' ORDER BY enterprise_id",
    );
    if (enterprise.rows.length !== 1) {
      throw new ConflictException({ code: "QAS-PORTFOLIO-ENTERPRISE-AMBIGUOUS" });
    }

    const snapshotPayload = {
      portfolio_control_board: board,
      change_feed: changeFeed,
    };
    const stateHash = createHash("sha256")
      .update(JSON.stringify(snapshotPayload))
      .digest("hex");
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ triggerType, sourceEventRefs, stateHash }))
      .digest("hex");
    const commandType = "CreatePortfolioReassessmentSnapshot";

    return this.database.transaction(async (client) => {
      const prior = await client.query<IdempotencyRow>(
        "SELECT request_hash, result_payload FROM qassas_core.command_idempotency WHERE actor_id = $1 AND command_type = $2 AND idempotency_key = $3",
        [actor.userId, commandType, idempotencyKey],
      );
      const existing = prior.rows[0];
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new ConflictException({ code: "QAS-IDEMPOTENCY-CONFLICT" });
        }
        return existing.result_payload;
      }

      const snapshotId = "PSNAP-" + randomUUID();
      const tenantId = enterprise.rows[0].enterprise_id;
      await client.query(
        "INSERT INTO qassas_core.portfolio_reassessment_snapshot (snapshot_id, enterprise_id, model_version, trigger_type, source_event_refs, asset_count, portfolio_state_hash, snapshot, created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          snapshotId,
          tenantId,
          board.model_version,
          triggerType,
          sourceEventRefs,
          board.visible_asset_count,
          stateHash,
          snapshotPayload,
          actor.userId,
        ],
      );

      await this.audit.write(client, {
        eventType: "PortfolioReassessmentSnapshotCreated",
        objectType: "PortfolioReassessmentSnapshot",
        objectId: snapshotId,
        objectVersion: 1,
        actorId: actor.userId,
        actorRole: "PORTFOLIO_EXECUTIVE",
        tenantId,
        correlationId,
        previousState: null,
        newState: "SNAPSHOT_CREATED",
        payload: {
          trigger_type: triggerType,
          source_event_refs: sourceEventRefs,
          asset_count: board.visible_asset_count,
          model_version: board.model_version,
          portfolio_state_hash: stateHash,
        },
      });

      const result = {
        snapshot_id: snapshotId,
        enterprise_id: tenantId,
        model_version: board.model_version,
        trigger_type: triggerType,
        source_event_refs: sourceEventRefs,
        asset_count: board.visible_asset_count,
        portfolio_state_hash: stateHash,
        snapshot_can_authorise_execution: false,
        snapshot_can_release_capital: false,
        snapshot_can_change_gate: false,
      };

      await client.query(
        "INSERT INTO qassas_core.command_idempotency (actor_id, command_type, idempotency_key, request_hash, result_payload) VALUES ($1,$2,$3,$4,$5)",
        [actor.userId, commandType, idempotencyKey, requestHash, result],
      );

      return result;
    });
  }

  async listSnapshots(actor: AuthenticatedActor) {
    this.requirePortfolioExecutive(actor);
    const result = await this.database.query<SnapshotRow>(
      "SELECT snapshot_id, enterprise_id, model_version, trigger_type, source_event_refs, asset_count, portfolio_state_hash, snapshot, created_by_user_id, created_at FROM qassas_core.portfolio_reassessment_snapshot ORDER BY created_at DESC, snapshot_id DESC",
    );
    return {
      snapshot_count: result.rows.length,
      snapshots: result.rows.map((row) => this.view(row, false)),
    };
  }

  async getSnapshot(snapshotId: string, actor: AuthenticatedActor) {
    this.requirePortfolioExecutive(actor);
    const result = await this.database.query<SnapshotRow>(
      "SELECT snapshot_id, enterprise_id, model_version, trigger_type, source_event_refs, asset_count, portfolio_state_hash, snapshot, created_by_user_id, created_at FROM qassas_core.portfolio_reassessment_snapshot WHERE snapshot_id = $1 LIMIT 1",
      [snapshotId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();
    return this.view(row, true);
  }

  private view(row: SnapshotRow, includePayload: boolean) {
    return {
      snapshot_id: row.snapshot_id,
      enterprise_id: row.enterprise_id,
      model_version: row.model_version,
      trigger_type: row.trigger_type,
      source_event_refs: row.source_event_refs ?? [],
      asset_count: Number(row.asset_count),
      portfolio_state_hash: row.portfolio_state_hash,
      created_by_user_id: row.created_by_user_id,
      created_at: row.created_at.toISOString(),
      snapshot: includePayload ? row.snapshot : undefined,
      immutable: true,
    };
  }

  private requirePortfolioExecutive(actor: AuthenticatedActor) {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (role.roleType !== "PORTFOLIO_EXECUTIVE" || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });
    if (!allowed) throw new NotFoundException();
  }
}
