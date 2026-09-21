import { Controller, Get } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

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
    const database = await this.database.ping();
    return {
      database: database ? "HEALTHY" : "FAILED",
      iam: "UNKNOWN",
      opa: "UNKNOWN",
      temporal: "UNKNOWN",
      audit: database ? "CONFIGURED_UNVERIFIED" : "UNAVAILABLE",
      outbox_publisher: "NOT_STARTED",
      controlled_writes_ready: false,
    };
  }
}
