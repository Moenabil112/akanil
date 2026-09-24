import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = path.resolve(process.cwd(), "artifacts/o2");
fs.mkdirSync(dir, { recursive: true });

const names = [
  "slo-evidence.json",
  "failure-recovery-evidence.json",
  "backup-restore-evidence.json",
  "ready.json",
  "business-controls.json",
  "release.json",
  "metrics.json",
];

const evidence = [];
for (const name of names) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) continue;
  const bytes = fs.readFileSync(file);
  evidence.push({
    file: name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const required = new Set([
  "slo-evidence.json",
  "failure-recovery-evidence.json",
  "backup-restore-evidence.json",
  "ready.json",
  "business-controls.json",
  "release.json",
  "metrics.json",
]);
const present = new Set(evidence.map((item) => item.file));
const missing = [...required].filter((name) => !present.has(name));

const bundle = {
  generated_at: new Date().toISOString(),
  release_id: process.env.QASSAS_RELEASE_ID ?? process.env.GITHUB_SHA ?? "unknown",
  phase: "O2",
  target_state: "TEST_READY",
  evidence,
  missing,
  result: missing.length === 0 ? "PASS" : "FAIL",
};

fs.writeFileSync(
  path.join(dir, "promotion-evidence-bundle.json"),
  JSON.stringify(bundle, null, 2),
);
console.log(JSON.stringify(bundle, null, 2));
if (missing.length > 0) process.exit(1);
