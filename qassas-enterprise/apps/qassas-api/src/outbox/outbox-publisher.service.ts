import { randomUUID } from "node:crypto";
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { DecisionReadModelConsumer } from "./decision-read-model.consumer";
import type { OutboxEventRow, OutboxHealth } from "./outbox.types";

interface HealthRow {
  pending_count: string;
  failed_count: string;
  oldest_pending_at: Date | null;
}

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly consumer: DecisionReadModelConsumer,
  ) {}

  onModuleInit(): void {
    if (!this.enabled()) {
      return;
    }

    const intervalMs = Number(
      process.env.OUTBOX_PUBLISH_INTERVAL_MS ?? 1000,
    );
    this.timer = setInterval(() => void this.publishBatch(), intervalMs);
    this.timer.unref();
    void this.publishBatch();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async publishBatch(): Promise<void> {
    if (this.running || !this.enabled()) {
      return;
    }

    this.running = true;
    try {
      const events = await this.claimBatch();
      for (const event of events) {
        await this.publishOne(event);
      }
    } finally {
      this.running = false;
    }
  }

  async health(): Promise<OutboxHealth> {
    if (!this.enabled()) {
      return {
        enabled: false,
        pendingCount: 0,
        failedCount: 0,
        oldestPendingAt: null,
        state: "DISABLED",
      };
    }

    const result = await this.database.query<HealthRow>(
      `SELECT
         count(*) FILTER (WHERE published_at IS NULL) AS pending_count,
         count(*) FILTER (
           WHERE published_at IS NULL AND last_error IS NOT NULL
         ) AS failed_count,
         min(created_at) FILTER (
           WHERE published_at IS NULL
         ) AS oldest_pending_at
       FROM qassas_outbox.outbox_event`,
    );

    const row = result.rows[0];
    const pendingCount = Number(row?.pending_count ?? 0);
    const failedCount = Number(row?.failed_count ?? 0);
    return {
      enabled: true,
      pendingCount,
      failedCount,
      oldestPendingAt: row?.oldest_pending_at?.toISOString() ?? null,
      state: failedCount > 0 ? "DEGRADED" : "HEALTHY",
    };
  }

  private enabled(): boolean {
    return (process.env.OUTBOX_PUBLISHER_ENABLED ?? "true") !== "false";
  }

  private async claimBatch(): Promise<OutboxEventRow[]> {
    const claimToken = `CLAIM-${randomUUID()}`;
    const batchSize = Math.max(
      1,
      Number(process.env.OUTBOX_PUBLISH_BATCH_SIZE ?? 25),
    );
    const timeoutSeconds = Math.max(
      30,
      Number(process.env.OUTBOX_CLAIM_TIMEOUT_SECONDS ?? 300),
    );

    const result = await this.database.query<OutboxEventRow>(
      `WITH claimable AS (
         SELECT outbox_event_id
           FROM qassas_outbox.outbox_event
          WHERE published_at IS NULL
            AND (
              claimed_at IS NULL OR
              claimed_at < now() - ($3::int * interval '1 second')
            )
          ORDER BY created_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE qassas_outbox.outbox_event e
          SET claim_token = $1,
              claimed_at = now(),
              publish_attempts = publish_attempts + 1,
              last_error = NULL
         FROM claimable c
        WHERE e.outbox_event_id = c.outbox_event_id
       RETURNING e.outbox_event_id, e.event_type, e.aggregate_type,
                 e.aggregate_id, e.aggregate_version, e.payload,
                 e.correlation_id, e.publish_attempts`,
      [claimToken, batchSize, timeoutSeconds],
    );

    return result.rows;
  }

  private async publishOne(event: OutboxEventRow): Promise<void> {
    try {
      await this.consumer.consume(event);
      await this.database.query(
        `UPDATE qassas_outbox.outbox_event
            SET published_at = now(),
                claimed_at = NULL,
                claim_token = NULL,
                last_error = NULL
          WHERE outbox_event_id = $1`,
        [event.outbox_event_id],
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown outbox error";
      this.logger.error(
        `Outbox publish failed for ${event.outbox_event_id}: ${message}`,
      );
      await this.database.query(
        `UPDATE qassas_outbox.outbox_event
            SET claimed_at = NULL,
                claim_token = NULL,
                last_error = $2
          WHERE outbox_event_id = $1`,
        [event.outbox_event_id, message.slice(0, 2000)],
      );
    }
  }
}
