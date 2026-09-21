import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

interface AuditRow {
  audit_event_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  object_version: string | null;
  actor_id: string | null;
  actor_role: string | null;
  correlation_id: string;
  causation_id: string | null;
  previous_state: string | null;
  new_state: string | null;
  payload_hash: string;
  previous_event_hash: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly database: DatabaseService) {}

  async history(objectId: string) {
    const result = await this.database.query<AuditRow>(
      `SELECT audit_event_id, event_type, object_type, object_id,
              object_version, actor_id, actor_role, correlation_id,
              causation_id, previous_state, new_state, payload_hash,
              previous_event_hash, payload, created_at
         FROM qassas_audit.audit_event
        WHERE object_id = $1
        ORDER BY created_at, audit_event_id`,
      [objectId],
    );

    return result.rows.map((row) => ({
      audit_event_id: row.audit_event_id,
      event_type: row.event_type,
      object_type: row.object_type,
      object_id: row.object_id,
      object_version: row.object_version ? Number(row.object_version) : null,
      actor_id: row.actor_id,
      actor_role: row.actor_role,
      correlation_id: row.correlation_id,
      causation_id: row.causation_id,
      previous_state: row.previous_state,
      new_state: row.new_state,
      payload_hash: row.payload_hash,
      previous_event_hash: row.previous_event_hash,
      payload: row.payload,
      created_at: row.created_at.toISOString(),
    }));
  }
}
