import { Injectable } from "@nestjs/common";

const MAX_LATENCY_SAMPLES = 5000;

@Injectable()
export class OperationalMetricsService {
  private requestCount = 0;
  private errorCount = 0;
  private readonly latenciesMs: number[] = [];
  private readonly startedAt = Date.now();

  observe(statusCode: number, durationMs: number): void {
    this.requestCount += 1;
    if (statusCode >= 500) {
      this.errorCount += 1;
    }

    this.latenciesMs.push(durationMs);
    if (this.latenciesMs.length > MAX_LATENCY_SAMPLES) {
      this.latenciesMs.splice(0, this.latenciesMs.length - MAX_LATENCY_SAMPLES);
    }
  }

  snapshot() {
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const p95Index =
      sorted.length === 0 ? 0 : Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    const sum = this.latenciesMs.reduce((acc, value) => acc + value, 0);

    return {
      process_uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requests_total: this.requestCount,
      server_errors_total: this.errorCount,
      server_error_ratio:
        this.requestCount === 0 ? 0 : this.errorCount / this.requestCount,
      latency_sample_count: this.latenciesMs.length,
      latency_ms_avg:
        this.latenciesMs.length === 0 ? 0 : Number((sum / this.latenciesMs.length).toFixed(2)),
      latency_ms_p95:
        sorted.length === 0 ? 0 : Number(sorted[p95Index].toFixed(2)),
      latency_ms_max:
        sorted.length === 0 ? 0 : Number(sorted[sorted.length - 1].toFixed(2)),
    };
  }
}
