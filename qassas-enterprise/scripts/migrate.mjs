import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

function config() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.QASSAS_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.QASSAS_DB_PORT ?? 5432),
    database: process.env.QASSAS_DB_NAME ?? "qassas",
    user: process.env.QASSAS_DB_USER ?? "qassas",
    password: process.env.QASSAS_DB_PASSWORD ?? "",
  };
}

const client = new Client(config());
await client.connect();

try {
  await client.query("CREATE SCHEMA IF NOT EXISTS qassas_core");
  await client.query(`
    CREATE TABLE IF NOT EXISTS qassas_core.schema_migration (
      migration_name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const dir = new URL("../database/migrations/", import.meta.url);
  const names = (await readdir(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of names) {
    const seen = await client.query(
      "SELECT 1 FROM qassas_core.schema_migration WHERE migration_name = $1",
      [name],
    );
    if (seen.rowCount) {
      console.log(`skip ${name}`);
      continue;
    }

    const sql = await readFile(join(dir.pathname, name), "utf8");
    try {
      // Migration files own their BEGIN/COMMIT boundary.
      await client.query(sql);
      await client.query(
        "INSERT INTO qassas_core.schema_migration (migration_name) VALUES ($1)",
        [name],
      );
      console.log(`applied ${name}`);
    } catch (error) {
      // Safe if a migration query failed while its transaction is aborted.
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }
} finally {
  await client.end();
}
