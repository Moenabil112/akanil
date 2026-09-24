const PROTECTED_ENVIRONMENTS = new Set([
  "test",
  "uat",
  "pilot",
  "production",
]);

const PLACEHOLDER_SECRET = /^(change-me|changeme|password|admin)$/i;

function environment(): string {
  return process.env.QASSAS_ENVIRONMENT ?? "local";
}

function hasLocalEndpoint(value?: string): boolean {
  if (!value) return true;
  return value.includes("127.0.0.1") || value.includes("localhost");
}

export function runtimeIdentity() {
  return {
    environment: environment(),
    releaseId: process.env.QASSAS_RELEASE_ID ?? "dev",
  };
}

export function assertRuntimeConfiguration(): void {
  const env = environment();

  if (!PROTECTED_ENVIRONMENTS.has(env)) {
    return;
  }

  const failures: string[] = [];
  const releaseId = process.env.QASSAS_RELEASE_ID;

  if (!releaseId || releaseId === "dev") {
    failures.push("QASSAS_RELEASE_ID must identify the deployed release");
  }

  for (const key of ["QASSAS_DB_PASSWORD", "KEYCLOAK_ADMIN_PASSWORD"]) {
    const value = process.env[key];
    if (!value || PLACEHOLDER_SECRET.test(value)) {
      failures.push(`${key} must not contain a placeholder value`);
    }
  }

  for (const key of ["KEYCLOAK_ISSUER", "OPA_URL", "TEMPORAL_ADDRESS"]) {
    if (hasLocalEndpoint(process.env[key])) {
      failures.push(`${key} must target a deployed service in ${env}`);
    }
  }

  if (!process.env.QASSAS_REQUIRED_MIGRATION) {
    failures.push("QASSAS_REQUIRED_MIGRATION is required");
  }

  if (failures.length > 0) {
    throw new Error(
      `QASSAS protected-environment configuration invalid: ${failures.join("; ")}`,
    );
  }
}
