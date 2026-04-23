/**
 * apps/api/src/middleware/require-tenant-context.ts
 *
 * Phase 0.4 — ensures the request carries a tenant_id before any DB access
 * can run. The actual GUC pinning happens inside `withTenant(db, ...)` in
 * `packages/db/src/tenant-context.ts`, which opens a transaction and sets
 * `app.current_tenant` transaction-locally.
 *
 * Must run AFTER `requireAuth`, never before. The tenant_id value comes
 * from `c.var.tenant_id` which requireAuth populated.
 *
 * The canonical GUC name is `app.current_tenant` — it matches the RLS
 * policies in `packages/db/migrations/0001_rls_policies.sql` and the
 * helper in `packages/db/src/tenant-context.ts`. Do not confuse it with
 * `app.tenant_id` which the Verifier spec (`.omc/verifier-spec/schema.sql`)
 * uses in a separate logical schema; the two are intentionally distinct.
 *
 * DO: wrap DB access in withTenant(db, tenant_id, async (tx) => { ... })
 *     which opens a transaction and sets app.current_tenant with
 *     set_config(..., true) (transaction-local, cleared on COMMIT/ROLLBACK).
 *
 * DON'T: call set_config('app.current_tenant', ..., false) — that persists
 *        across pool checkouts in postgres-js and leaks tenant context to
 *        the next request served by the same pooled connection.
 */

import type { Context, Next } from 'hono';
import type { AuthedEnv } from './require-auth.js';

export async function requireTenantContext(
  c: Context<AuthedEnv>,
  next: Next,
): Promise<Response | void> {
  const tenant_id = c.get('tenant_id');

  if (!tenant_id) {
    // Programmer error — requireAuth should have run first and populated
    // c.var.tenant_id. Fail closed at 403 so a misordered middleware chain
    // cannot quietly run DB queries without a tenant scope.
    return c.json(
      {
        error: 'TENANT_CONTEXT_MISSING',
        message: 'requireTenantContext must run after requireAuth',
      },
      403,
    );
  }

  // TODO(phase-1.1): once `packages/db` is wired into this app, open the
  // scoped transaction here via withTenant(db, tenant_id, fn). Until then,
  // this middleware only enforces ordering — actual GUC pinning happens at
  // each DB call site that already uses withTenant().

  await next();
}
