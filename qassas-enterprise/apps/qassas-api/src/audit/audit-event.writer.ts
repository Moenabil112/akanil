import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";

export interface GovernanceEventInput {
  eventType: string;
  objectType: string;
  objectId: string;
  objectVersion: number;
  actorId: string;
  actorRole?: string | null;
  tenantId: string;
  correlationId: string;
  causationId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditEventWriter {
  async write(
    client: PoolClient,
    input: GovernanceEventInput,
  ): Promise<{ auditEventId: string; outboxEventId: string }> {
    const payload = input.payload ?? {};
    const payloadText = JSON.stringify(payload);
    const payloadHash = createHash("sha256").update(payloadText).digest("hex");

    const previous = await client.query<{ payload_hash: string }>(
      `SELECT payload_hash
         FROM qassas_audit.audit_event
        WHERE object_type = $1 AND object_id = $2
        ORDER BY created_at DESC, audit_event_id DESC
        LIMIT 1`,
      [input.objectType, input.objectId],
    );

    const auditEventId = `AUD-${randomUUID()}`;
    const outboxEventId = `EVT-${randomUUID()}`;
    const occurredAt = new Date().toISOString();

    await client.query(
      `INSERT INTO qassas_audit.audit_event (
         audit_event_id, event_type, object_type, object_id, object_version,
         actor_id, actor_role, tenant_id, correlation_id, causation_id,
         previous_state, new_state, payload_hash, previous_event_hash, payload
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
       )`,
      [
        auditEventId,
        input.eventType,
        input.objectType,
        input.objectId,
        input.objectVersion,
        input.actorId,
        input.actorRole ?? null,
        input.tenantId,
        input.correlationId,
        input.causationId ?? null,
        input.previousState ?? null,
        input.newState ?? null,
        payloadHash,
        previous.rows[0]?.payload_hash ?? null,
        payload,
      ],
    );

    await client.query(
      `INSERT INTO qassas_outbox.outbox_event (
         outbox_event_id, event_type, aggregate_type, aggregate_id,
         aggregate_version, payload, correlation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        outboxEventId,
        input.eventType,
        input.objectType,
        input.objectId,
        input.objectVersion,
        {
          event_id: auditEventId,
          event_type: input.eventType,
          event_version: 1,
          occurred_at: occurredAt,
          tenant_id: input.tenantId,
          actor: {
            actor_id: input.actorId,
            actor_role: input.actorRole ?? null,
          },
          object: {
            object_type: input.objectType,
            object_id: input.objectId,
            object_version: input.objectVersion,
          },
          correlation_id: input.correlationId,
          causation_id: input.causationId ?? null,
          previous_state: input.previousState ?? null,
          new_state: input.newState ?? null,
          payload,
        },
        input.correlationId,
      ],
    );

    return { auditEventId, outboxEventId };
  }
}
