import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { KeycloakJwtService } from "../auth/keycloak-jwt.service";
import { OpaPolicyService } from "../auth/opa-policy.service";
import { DatabaseService } from "../database/database.service";
import { OutboxPublisherService } from "../outbox/outbox-publisher.service";
import { runtimeIdentity } from "../runtime/runtime-config";
import { TemporalWorkflowService } from "../temporal/temporal-workflow.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly temporal: TemporalWorkflowService,
    private readonly outbox: OutboxPublisherService,
    private readonly iam: KeycloakJwtService,
    private readonly opa: OpaPolicyService,
  ) {}

  @Get("live")
  live() {
    const identity = runtimeIdentity();
    return {
      status: "HEALTHY",
      service: "qassas-api",
      environment: identity.environment,
      release_id: identity.releaseId,
    };
  }

  @Get("release")
  release() {
    const identity = runtimeIdentity();
    return {
      service: "qassas-api",
      service_version: process.env.QASSAS_SERVICE_VERSION ?? "0.0.1",
      environment: identity.environment,
      release_id: identity.releaseId,
      node_version: process.version,
    };
  }

  @Get("ready")
  async ready() {
    const snapshot = await this.snapshot();

    if (!snapshot.ready) {
      throw new ServiceUnavailableException({
        status: "DEGRADED",
        service: "qassas-api",
        ...snapshot,
      });
    }

    return {
      status: "HEALTHY",
      service: "qassas-api",
      ...snapshot,
    };
  }

  @Get("business-controls")
  async businessControls() {
    const snapshot = await this.snapshot();

    return {
      database: snapshot.database,
      migrations: snapshot.migrations,
      iam: snapshot.iam,
      opa: snapshot.opa,
      temporal: snapshot.temporal,
      audit:
        snapshot.database === "HEALTHY" && snapshot.migrations === "HEALTHY"
          ? "AVAILABLE"
          : "UNAVAILABLE",
      outbox_publisher: snapshot.outbox.state,
      outbox_pending_count: snapshot.outbox.pendingCount,
      outbox_failed_count: snapshot.outbox.failedCount,
      controlled_writes_ready: snapshot.ready,
      release_id: snapshot.release_id,
      environment: snapshot.environment,
    };
  }

  private async snapshot() {
    const identity = runtimeIdentity();

    const [database, migration, temporal, iam, opa, outbox] = await Promise.all([
      this.database.ping(),
      this.database.migrationHealth(),
      this.temporal.health(),
      this.iam.health(),
      this.opa.health(),
      this.outbox.health().catch(() => ({
        enabled: true,
        pendingCount: 0,
        failedCount: 1,
        oldestPendingAt: null,
        state: "DEGRADED" as const,
      })),
    ]);

    const outboxReady = outbox.enabled && outbox.state === "HEALTHY";
    const ready =
      database &&
      migration.healthy &&
      temporal &&
      iam &&
      opa &&
      outboxReady;

    return {
      ready,
      environment: identity.environment,
      release_id: identity.releaseId,
      database: database ? "HEALTHY" : "FAILED",
      migrations: migration.healthy ? "HEALTHY" : "FAILED",
      required_migration: migration.requiredMigration,
      latest_applied_migration: migration.latestAppliedMigration,
      applied_migration_count: migration.appliedCount,
      iam: iam ? "HEALTHY" : "FAILED",
      opa: opa ? "HEALTHY" : "FAILED",
      temporal: temporal ? "HEALTHY" : "FAILED",
      outbox,
    };
  }
}
