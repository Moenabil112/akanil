import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import type { OutboxEventRow } from "./outbox.types";

@Injectable()
export class DecisionReadModelConsumer {
  private readonly consumerName = "decision-read-model";

  constructor(private readonly database: DatabaseService) {}

  async consume(event: OutboxEventRow): Promise<void> {
    await this.database.transaction(async (client) => {
      const accepted = await this.recordDelivery(client, event);
      if (!accepted) {
        return;
      }

      if (event.aggregate_type !== "DecisionObject") {
        return;
      }

      const envelope = event.payload as {
        new_state?: string | null;
        occurred_at?: string;
      };
      if (!envelope.new_state) {
        return;
      }

      await client.query(
        `INSERT INTO qassas_core.decision_read_model (
           decision_id, state, object_version, last_event_type,
           correlation_id, last_event_at
         ) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (decision_id) DO UPDATE SET
           state = EXCLUDED.state,
           object_version = EXCLUDED.object_version,
           last_event_type = EXCLUDED.last_event_type,
           correlation_id = EXCLUDED.correlation_id,
           last_event_at = EXCLUDED.last_event_at
         WHERE EXCLUDED.object_version >= qassas_core.decision_read_model.object_version`,
        [
          event.aggregate_id,
          envelope.new_state,
          Number(event.aggregate_version),
          event.event_type,
          event.correlation_id,
          envelope.occurred_at ?? new Date().toISOString(),
        ],
      );
    });
  }

  private async recordDelivery(
    client: PoolClient,
    event: OutboxEventRow,
  ): Promise<boolean> {
    const result = await client.query(
      `INSERT INTO qassas_outbox.consumer_delivery (
         consumer_name, outbox_event_id
       ) VALUES ($1,$2)
       ON CONFLICT DO NOTHING
       RETURNING outbox_event_id`,
      [this.consumerName, event.outbox_event_id],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
