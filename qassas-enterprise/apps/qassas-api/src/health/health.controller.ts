import { Controller, Get } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { TemporalWorkflowService } from "../temporal/temporal-workflow.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly temporal: TemporalWorkflowService,
  ) {}

  @Get("live")
  live() {
    return { status: "HEALTHY", service: "qassas-api" };
  }

  @Get("ready")
  async ready() {
    const database = await this.database.ping();
    return {
      status: database ? "HEALTHY" : "DEGRADED",
      service: "qassas-api",
      database: database ? "HEALTHY" : "FAILED",
    };
  }

  @Get("business-controls")
  async businessControls() {
    const [database, temporal] = await Promise.all([
      this.database.ping(),
      this.temporal.health(),
    ]);

    return {
      database: database ? "HEALTHY" : "FAILED",
      iam: "CONFIGURED_UNVERIFIED",
      opa: "CONFIGURED_UNVERIFIED",
      temporal: temporal ? "HEALTHY" : "FAILED",
      audit: database ? "CONFIGURED_UNVERIFIED" : "UNAVAILABLE",
      outbox_publisher: "NOT_STARTED",
      controlled_writes_ready: database && temporal,
    };
  }
}
