import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options: postgres.Options<Record<string, never>> = {}) {
  const sql = postgres(url, { max: 10, ...options });
  return Object.assign(drizzle(sql, { schema, casing: "snake_case" }), { $sql: sql });
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { zfunnelDb?: Db };

/** Process-wide connection pool, reused across Next.js hot reloads. */
export function getDb(): Db {
  if (!globalForDb.zfunnelDb) {
    const url = process.env.DATABASE_URL;
    // `next build` imports route modules without needing a database; the pool connects lazily.
    const building = process.env.NEXT_PHASE === "phase-production-build";
    if (!url && !building) throw new Error("DATABASE_URL is not set");
    globalForDb.zfunnelDb = createDb(url ?? "postgres://build-time-placeholder/none");
  }
  return globalForDb.zfunnelDb;
}
