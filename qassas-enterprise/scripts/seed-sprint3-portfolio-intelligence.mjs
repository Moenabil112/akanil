import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

function config() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
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
  const file = new URL(
    "../database/seeds/202609220003_sprint3_portfolio_intelligence.sql",
    import.meta.url,
  );
  const sql = await readFile(file, "utf8");
  await client.query(sql);
  console.log("Sprint 3 portfolio intelligence synthetic seed applied");
} finally {
  await client.end();
}
