import fs from "node:fs";
import path from "node:path";

const environments = ["pilot", "production"];
const failures = [];

for (const environment of environments) {
  const profilePath = path.resolve(
    process.cwd(),
    `keycloak/profiles/${environment}/qassas-realm.json`,
  );

  if (!fs.existsSync(profilePath)) {
    failures.push(`${environment}: realm profile is missing`);
    continue;
  }

  const realm = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const clients = Array.isArray(realm.clients) ? realm.clients : [];
  const users = Array.isArray(realm.users) ? realm.users : [];

  if (clients.some((client) => client?.clientId === "qassas-cli")) {
    failures.push(`${environment}: qassas-cli is forbidden`);
  }

  if (clients.some((client) => client?.directAccessGrantsEnabled === true)) {
    failures.push(`${environment}: direct access grants are forbidden`);
  }

  if (users.length > 0) {
    failures.push(`${environment}: synthetic/imported users are forbidden`);
  }

  const apiClient = clients.find((client) => client?.clientId === "qassas-api");
  if (!apiClient || apiClient.bearerOnly !== true) {
    failures.push(`${environment}: qassas-api bearer-only client is required`);
  }
}

if (failures.length > 0) {
  console.error("Protected IAM profile validation — FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Protected IAM profile validation — PASS");
