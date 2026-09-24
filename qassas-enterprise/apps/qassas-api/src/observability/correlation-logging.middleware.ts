import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Injectable } from "@nestjs/common";
import { runtimeIdentity } from "../runtime/runtime-config";
import { OperationalMetricsService } from "./operational-metrics.service";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

@Injectable()
export class CorrelationLoggingMiddleware {
  constructor(private readonly metrics: OperationalMetricsService) {}

  use(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void {
    const incoming = req.headers["x-correlation-id"];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const correlationId =
      typeof candidate === "string" && CORRELATION_ID_PATTERN.test(candidate)
        ? candidate
        : randomUUID();

    res.setHeader("x-correlation-id", correlationId);
    const startedAt = performance.now();
    const requestPath = (req.url ?? "/").split("?")[0];
    const shouldMeasure = requestPath !== "/api/v1/observability/metrics";

    res.on("finish", () => {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      if (shouldMeasure) {
        this.metrics.observe(res.statusCode, durationMs);
      }

      const identity = runtimeIdentity();
      process.stdout.write(
        `${JSON.stringify({
          level: res.statusCode >= 500 ? "error" : "info",
          event: "http_request_completed",
          timestamp: new Date().toISOString(),
          service: "qassas-api",
          environment: identity.environment,
          release_id: identity.releaseId,
          correlation_id: correlationId,
          method: req.method ?? "UNKNOWN",
          path: requestPath,
          status_code: res.statusCode,
          duration_ms: durationMs,
        })}\n`,
      );
    });

    next();
  }
}
