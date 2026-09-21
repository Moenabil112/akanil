export interface OutboxEventRow {
  outbox_event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: string;
  payload: Record<string, unknown>;
  correlation_id: string;
  publish_attempts: number;
}

export interface OutboxHealth {
  enabled: boolean;
  pendingCount: number;
  failedCount: number;
  oldestPendingAt: string | null;
  state: "HEALTHY" | "DEGRADED" | "DISABLED";
}
