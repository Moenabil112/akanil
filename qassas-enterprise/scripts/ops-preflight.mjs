import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const fileArg = args.find((arg) => !arg.startsWith("--")) ?? ".env";
const allowPlaceholderSecrets = args.includes("--allow-placeholder-secrets");
const envPath = path.resolve(process.cwd(), fileArg);

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function fail(message) {
  failures.push(message);
}

function isFloatingImage(value) {
  if (!value) return true;
  const noDigest = !value.includes("@sha256:");
  const tag = value.includes(":") ? value.split(":").pop() : "";
  return noDigest && (!tag || tag === "latest" || tag === "edge" || tag === "main");
}

if (!fs.existsSync(envPath)) {
  console.error(`Operational preflight: env file not found: ${envPath}`);
  process.exit(2);
}

const cfg = parseEnv(fs.readFileSync(envPath, "utf8"));
const failures = [];

const environment = cfg.QASSAS_ENVIRONMENT || process.env.QASSAS_ENVIRONMENT || "";
const allowed = new Set(["local", "ci", "test", "uat", "pilot", "production"]);
if (!allowed.has(environment)) {
  fail(`QASSAS_ENVIRONMENT must be one of: ${[...allowed].join(", ")}`);
}

if (!cfg.QASSAS_RELEASE_ID) {
  fail("QASSAS_RELEASE_ID is required");
}

if (!cfg.QASSAS_REQUIRED_MIGRATION) {
  fail("QASSAS_REQUIRED_MIGRATION is required");
}

for (const key of ["POSTGIS_IMAGE", "KEYCLOAK_IMAGE", "OPA_IMAGE", "TEMPORAL_IMAGE"]) {
  if (isFloatingImage(cfg[key])) {
    fail(`${key} must use a version tag or immutable digest; floating tags are forbidden`);
  }
}

const protectedEnv = ["test", "uat", "pilot", "production"].includes(environment);

if (protectedEnv && /^(dev|test-unset|unset)$/i.test(cfg.QASSAS_RELEASE_ID ?? "")) {
  fail("QASSAS_RELEASE_ID must identify a concrete protected-environment release");
}

if (protectedEnv && !allowPlaceholderSecrets) {
  for (const key of ["QASSAS_DB_PASSWORD", "KEYCLOAK_ADMIN_PASSWORD"]) {
    if (!cfg[key] || /^(change-me|changeme|password|admin)$/i.test(cfg[key])) {
      fail(`${key} contains a placeholder or unsafe default`);
    }
  }
}

if (protectedEnv) {
  const localTokens = ["127.0.0.1", "localhost"];
  for (const key of ["KEYCLOAK_ISSUER", "OPA_URL", "TEMPORAL_ADDRESS"]) {
    if (!cfg[key] || localTokens.some((token) => cfg[key].includes(token))) {
      fail(`${key} must target a deployed service in ${environment}`);
    }
  }

  if ((cfg.TEMPORAL_IMAGE ?? "").includes("temporalio/auto-setup")) {
    fail("temporalio/auto-setup is a Local/CI harness and is forbidden in protected environments");
  }

  if (environment === "test") {
    if (!(cfg.TEMPORAL_IMAGE ?? "").startsWith("temporalio/server:")) {
      fail("TEST must use a pinned temporalio/server image");
    }
    for (const key of ["TEMPORAL_ADMIN_TOOLS_IMAGE", "TEMPORAL_DB_IMAGE"]) {
      if (isFloatingImage(cfg[key])) {
        fail(`${key} must use a version tag or immutable digest in TEST`);
      }
    }
  }
}

if (["pilot", "production"].includes(environment)) {
  const profilePath = path.resolve(
    process.cwd(),
    `keycloak/profiles/${environment}/qassas-realm.json`,
  );

  if (!fs.existsSync(profilePath)) {
    fail(`Keycloak ${environment} realm profile is missing`);
  } else {
    const realm = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    const clients = Array.isArray(realm.clients) ? realm.clients : [];
    if (clients.some((client) => client?.clientId === "qassas-cli")) {
      fail("qassas-cli direct-grant client is forbidden in Pilot/Production realm configuration");
    }
    if (clients.some((client) => client?.directAccessGrantsEnabled === true)) {
      fail("direct access grants are forbidden in Pilot/Production realm configuration");
    }
  }
}

if (failures.length > 0) {
  console.error("QASSAS Operational Preflight — FAIL");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("QASSAS Operational Preflight — PASS");
console.log(JSON.stringify({
  environment,
  release_id: cfg.QASSAS_RELEASE_ID,
  required_migration: cfg.QASSAS_REQUIRED_MIGRATION,
  runtime_images: {
    postgis: cfg.POSTGIS_IMAGE,
    keycloak: cfg.KEYCLOAK_IMAGE,
    opa: cfg.OPA_IMAGE,
    temporal: cfg.TEMPORAL_IMAGE,
    temporal_admin_tools: cfg.TEMPORAL_ADMIN_TOOLS_IMAGE ?? null,
    temporal_db: cfg.TEMPORAL_DB_IMAGE ?? null,
  }
}, null, 2));
