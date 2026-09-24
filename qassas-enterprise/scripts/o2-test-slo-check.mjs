import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.QASSAS_API_URL ?? "http://127.0.0.1:3001/api/v1";
const p95Limit = Number(process.env.QASSAS_TEST_P95_LATENCY_MS ?? 1000);
const max5xxRatio = Number(process.env.QASSAS_TEST_MAX_5XX_RATIO ?? 0.01);
const sampleCount = Number(process.env.QASSAS_TEST_SAMPLE_COUNT ?? 25);

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const body = await response.json();
  return { response, body };
}

const samples = [];
let correlationFailures = 0;

for (let i = 0; i < sampleCount; i += 1) {
  const correlationId = `O2-SLO-${String(i).padStart(4, "0")}`;
  const started = performance.now();
  const response = await fetch(`${baseUrl}/health/ready`, {
    headers: { "x-correlation-id": correlationId },
    signal: AbortSignal.timeout(5000),
  });
  const durationMs = performance.now() - started;

  if (response.headers.get("x-correlation-id") !== correlationId) {
    correlationFailures += 1;
  }

  samples.push({
    status: response.status,
    duration_ms: durationMs,
  });
}

const ready = await json(`${baseUrl}/health/ready`);
const metrics = await json(`${baseUrl}/observability/metrics`);

const durations = samples.map((sample) => sample.duration_ms).sort((a, b) => a - b);
const p95Index = Math.min(
  durations.length - 1,
  Math.max(0, Math.ceil(durations.length * 0.95) - 1),
);
const p95 = durations.length === 0 ? 0 : durations[p95Index];
const fiveXx = samples.filter((sample) => sample.status >= 500).length;
const fiveXxRatio = samples.length === 0 ? 0 : fiveXx / samples.length;

const failures = [];
if (!ready.response.ok || ready.body.ready !== true) failures.push("readiness");
if (samples.length < sampleCount) failures.push("insufficient_samples");
if (p95 > p95Limit) failures.push(`steady_state_p95_latency_ms>${p95Limit}`);
if (fiveXxRatio > max5xxRatio) failures.push(`steady_state_5xx_ratio>${max5xxRatio}`);
if (correlationFailures > 0) failures.push("correlation_id_roundtrip");
if (metrics.body.latency_sample_count < sampleCount) failures.push("metrics_not_recording_requests");

const evidence = {
  captured_at: new Date().toISOString(),
  release_id: ready.body.release_id,
  environment: ready.body.environment,
  measurement_window: "STEADY_STATE_AFTER_READINESS",
  thresholds: {
    samples: sampleCount,
    p95_latency_ms_max: p95Limit,
    server_error_ratio_max: max5xxRatio,
  },
  measured: {
    sample_count: samples.length,
    p95_latency_ms: Number(p95.toFixed(2)),
    server_5xx_count: fiveXx,
    server_5xx_ratio: fiveXxRatio,
    correlation_id_failures: correlationFailures,
  },
  readiness: ready.body,
  process_metrics_snapshot: metrics.body,
  result: failures.length === 0 ? "PASS" : "FAIL",
  failures,
};

const outputDir = path.resolve(process.cwd(), "artifacts/o2");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "slo-evidence.json"),
  JSON.stringify(evidence, null, 2),
);

console.log(JSON.stringify(evidence, null, 2));
if (failures.length > 0) process.exit(1);
