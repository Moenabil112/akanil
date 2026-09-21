import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get("live")
  live() {
    return { status: "HEALTHY", service: "qassas-api" };
  }

  @Get("ready")
  ready() {
    return { status: "HEALTHY", service: "qassas-api" };
  }

  @Get("business-controls")
  businessControls() {
    return {
      database: "UNKNOWN",
      iam: "UNKNOWN",
      opa: "UNKNOWN",
      temporal: "UNKNOWN",
      audit: "UNKNOWN",
      outbox_publisher: "UNKNOWN",
      controlled_writes_ready: false,
    };
  }
}
