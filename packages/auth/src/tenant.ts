/**
 * packages/auth/src/tenant.ts
 *
 * Phase 0.4 — tenant resolution seam.
 *
 * For every authenticated WorkOS user, find the ONE tenant they belong to
 * and their role inside it. The real lookup lands in Phase 0.3 once
 * `packages/db` has the `tenant_members` table — until then this is a stub
 * that reads a hard-coded dev-only mapping from env.
 *
 * IMPORTANT: This is the single chokepoint that decides which tenant a
 * request runs under. RLS downstream trusts this. Don't add branches here
 * without a review.
 *
 * Prod guard: if `NODE_ENV === 'production'` AND any `DEV_AUTH_*` var is set,
 * we throw at module load. Dev shims in prod are a direct auth-bypass risk.
 * This is a startup failure by design — Doppler prod config MUST NOT carry
 * these keys (see docs/SECRETS.md "Hard rules").
 */

import type { AuthenticatedUser, TenantContext } from './types';
import { asTenantId, isRole, type Role } from './types';
import { AuthError, TenantMismatchError } from './errors';

/**
 * Enforce that DEV_AUTH_* vars never ship to production. Called at module
 * load so a misconfigured deploy fails fast at boot, not on the first
 * request that hits the middleware.
 *
 * Exported for tests so suites that flip NODE_ENV can re-run the check
 * deterministically without a full module-reset dance.
 */
export function assertDevAuthNotInProd(): void {
  const nodeEnv = process.env.NODE_ENV;
  const hasDevShim =
    typeof process.env.DEV_AUTH_TENANT_ID === 'string' ||
    typeof process.env.DEV_AUTH_ROLE === 'string';

  if (!hasDevShim) return;

  if (nodeEnv === 'production') {
    throw new AuthError(
      'DEV_AUTH_TENANT_ID / DEV_AUTH_ROLE must not be set in production. ' +
        'These bypass real tenant lookup and are a direct auth-bypass risk. ' +
        'Remove them from Doppler prod config immediately.',
      'DEV_SHIM_IN_PROD',
    );
  }

  if (nodeEnv === undefined) {
    // Not prod, but not explicitly dev either. Warn loudly (stderr) so the
    // human notices in CI output and container logs; don't throw, because
    // CI runners legitimately leave NODE_ENV unset.
    //
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] DEV_AUTH_* is set but NODE_ENV is undefined. ' +
        'This is safe for local dev but would be fatal in production — ' +
        'make sure Doppler staging/prod configs do not carry DEV_AUTH_*.',
    );
  }
}

// Run the check at module load. If this throws, the process dies at import —
// exactly the behavior we want for a misconfigured prod deploy.
assertDevAuthNotInProd();

/**
 * Resolve a WorkOS user to their tenant + role.
 *
 * Phase 0.3 will replace this body with a `db.query.tenantMembers.findFirst(...)`
 * call. The signature must stay stable.
 *
 * @throws {TenantMismatchError} if the user has no tenant mapping.
 * @throws {AuthError} with code `DEV_SHIM_IN_PROD` if DEV_AUTH_* leaked into prod.
 */
export async function resolveTenantFromUser(
  user: AuthenticatedUser,
): Promise<TenantContext> {
  // Re-assert at call time as a defense-in-depth check in case the env was
  // mutated at runtime (tests, serverless cold paths that reload env). This
  // is cheap (two string checks).
  assertDevAuthNotInProd();

  // TODO(phase-0.3): wire real DB lookup.
  //
  //   const row = await db.query.tenantMembers.findFirst({
  //     where: eq(tenantMembers.user_workos_id, user.id),
  //     columns: { tenant_id: true, role: true },
  //   });
  //   if (!row) throw new TenantMismatchError(...);
  //   if (!isRole(row.role)) throw new AuthError('Invalid role stored in DB');
  //   return { tenant_id: asTenantId(row.tenant_id), role: row.role };

  // Dev-only shim: read from env so the middleware chain can be exercised
  // end-to-end before 0.3 lands. NEVER ship this path enabled in prod.
  const devTenantId = process.env.DEV_AUTH_TENANT_ID;
  const devRole = process.env.DEV_AUTH_ROLE;

  if (!devTenantId || !devRole) {
    // TODO(phase-post-mvp): JIT provisioning branch.
    // If WorkOS user has a verified work email matching a registered tenant
    // domain, auto-create the tenant_members row here.
    throw new TenantMismatchError(
      `No tenant mapping for WorkOS user ${user.id}. Phase 0.3 wires real lookup; set DEV_AUTH_TENANT_ID + DEV_AUTH_ROLE for local dev.`,
    );
  }

  if (!isRole(devRole)) {
    throw new TenantMismatchError(
      `DEV_AUTH_ROLE=${devRole} is not a valid role. Expected one of: admin, clinician, bd, read_only.`,
    );
  }

  const role: Role = devRole;
  return { tenant_id: asTenantId(devTenantId), role };
}
