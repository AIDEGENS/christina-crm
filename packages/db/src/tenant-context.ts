/**
 * packages/db/src/tenant-context.ts
 *
 * Helper to run a function inside a transaction that has
 * `SET LOCAL app.current_tenant = '<uuid>'` pinned. The RLS policies in
 * migrations/0001_rls_policies.sql read that GUC via current_setting(...).
 *
 * Usage (in an API route):
 *
 *   await withTenant(db, req.session.tenantId, async (tx) => {
 *     return tx.select().from(referrals);  // RLS applied
 *   });
 *
 * IMPORTANT:
 *   - Uses SET LOCAL so the value scopes to the transaction only. When the
 *     transaction commits/rolls back the GUC is cleared — no leakage between
 *     pooled connections.
 *   - If `tenantId` is not a valid UUID, Postgres rejects the cast. That is
 *     desired: fail fast rather than silently match 0 rows.
 *   - Never call this with a tenantId derived from user-controlled input
 *     without authorization — the WorkOS session claim is the source of truth.
 */

import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import type * as schema from './schema/index.js';

type AnyDb = PostgresJsDatabase<typeof schema>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTenant<T>(
  db: AnyDb,
  tenantId: string,
  fn: (tx: AnyDb) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error('withTenant: tenantId is not a valid UUID');
  }

  return db.transaction(async (tx) => {
    // set_config with is_local=true scopes to the transaction.
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx as AnyDb);
  });
}
