import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy-initialized singleton. Pre-BAA: this is NOT invoked against any live DB.
// Post-BAA: step 0.4 middleware wraps queries in `withTenantContext` to set
// `SET LOCAL app.current_tenant = '<uuid>'` for RLS enforcement.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Required to initialize @crm/db client.");
  }
  const sql = postgres(url, { max: 10 });
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };
