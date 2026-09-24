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

for (let i = 0; i < sampleCount; i += 1) {
  const response = await fetch(`${baseUrl}/health/live`, {
    headers: { "x-correlation-id": `O2-SLO-${String(i).padStart(4, "0")}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`SLO warmup request failed: ${response.status}`);
  }
}

const ready = await json(`${baseUrl}/health/ready`);
const metrics = await json(`${baseUrl}/observability/metrics`);

const failures = [];
if (!ready.response.ok || ready.body.ready !== true) {
  failures.push("readiness");
}
if (metrics.body.latency_sample_count < sampleCount) {
  failures.push("insufficient_latency_samples");
}
if (metrics.body.latency_ms_p95 > p95Limit) {
  failures.push(`p95_latency_ms>${p95Limit}`);
}
if (metrics.body.server_error_ratio > max5xxRatio) {
  failures.push(`server_error_ratio>${max5xxRatio}`);
}

const evidence = {
  captured_at: new Date().toISOString(),
  release_id: ready.body.release_id,
  environment: ready.body.environment,
  thresholds: {
    minimum_samples: sampleCount,
    p95_latency_ms_max: p95Limit,
    server_error_ratio_max: max5xxRatio,
  },
  readiness: ready.body,
  metrics: metrics.body,
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
