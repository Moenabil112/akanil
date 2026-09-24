import { Controller, Get } from "@nestjs/common";
import { runtimeIdentity } from "../runtime/runtime-config";
import { OperationalMetricsService } from "./operational-metrics.service";

@Controller("observability")
export class ObservabilityController {
  constructor(private readonly metrics: OperationalMetricsService) {}

  @Get("metrics")
  metricsSnapshot() {
    const identity = runtimeIdentity();
    return {
      service: "qassas-api",
      environment: identity.environment,
      release_id: identity.releaseId,
      captured_at: new Date().toISOString(),
      metrics_scope: "PROCESS_LOCAL_TEST_BASELINE",
      ...this.metrics.snapshot(),
    };
  }
}
