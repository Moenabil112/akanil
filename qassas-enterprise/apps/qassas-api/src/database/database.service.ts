import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

function connectionConfig() {
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

export interface MigrationHealth {
  healthy: boolean;
  requiredMigration: string | null;
  requiredMigrationApplied: boolean;
  appliedCount: number;
  latestAppliedMigration: string | null;
}

interface MigrationHealthRow {
  applied_count: string;
  latest_applied_migration: string | null;
  required_migration_applied: boolean;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool(connectionConfig());

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("select 1");
      return true;
    } catch {
      return false;
    }
  }

  async migrationHealth(): Promise<MigrationHealth> {
    const requiredMigration = process.env.QASSAS_REQUIRED_MIGRATION ?? null;

    try {
      const result = await this.pool.query<MigrationHealthRow>(
        `SELECT
           count(*)::text AS applied_count,
           max(migration_name) AS latest_applied_migration,
           CASE
             WHEN $1::text IS NULL THEN false
             ELSE bool_or(migration_name = $1)
           END AS required_migration_applied
         FROM qassas_core.schema_migration`,
        [requiredMigration],
      );

      const row = result.rows[0];
      const requiredMigrationApplied =
        requiredMigration !== null && row?.required_migration_applied === true;

      return {
        healthy: requiredMigrationApplied,
        requiredMigration,
        requiredMigrationApplied,
        appliedCount: Number(row?.applied_count ?? 0),
        latestAppliedMigration: row?.latest_applied_migration ?? null,
      };
    } catch {
      return {
        healthy: false,
        requiredMigration,
        requiredMigrationApplied: false,
        appliedCount: 0,
        latestAppliedMigration: null,
      };
    }
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
