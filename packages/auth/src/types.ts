/**
 * packages/auth/src/types.ts
 *
 * Phase 0.4 — WorkOS auth type surface.
 *
 * Everything that crosses a trust boundary (cookie, HTTP header, db row)
 * MUST be typed via these. In particular, tenant IDs use a nominal brand
 * so you can't accidentally pass a `user_id` where a `tenant_id` is needed.
 */

/**
 * Branded tenant identifier. Prevents tenant_id ↔ user_id ↔ free-string mix-ups
 * at the type level. Create one with `asTenantId(raw)` after validation.
 */
export type TenantId = string & { readonly __brand: 'tenant_id' };

/**
 * Narrow a validated string into a TenantId.
 *
 * Call this ONLY after you've confirmed the value came from a trusted
 * source (DB row, signed session cookie, WorkOS user metadata).
 */
export function asTenantId(raw: string): TenantId {
  return raw as TenantId;
}

/**
 * Role enum — pinned for Phase 0.4. New roles require a migration + review.
 * See REF/CRM-08-SECURITY-HIPAA.md for role/permission matrix.
 */
export type Role = 'admin' | 'clinician' | 'bd' | 'read_only';

export const ROLES: readonly Role[] = ['admin', 'clinician', 'bd', 'read_only'] as const;

export function isRole(raw: string): raw is Role {
  return (ROLES as readonly string[]).includes(raw);
}

/**
 * The shape WorkOS hands us (subset we care about).
 * WorkOS returns more fields — pick deliberately, avoid bleed.
 *
 * `impersonator` is populated by `decodeSession` when the WorkOS session
 * cookie carries an impersonator block (WorkOS team member acting as a
 * tenant user via the dashboard). Downstream audit/metrics/logging MUST
 * tag every action with this when present — it is how HIPAA incident
 * response proves whether a real clinician or an internal operator did
 * the thing. See packages/auth/src/session.ts for the decode seam.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  impersonator?: {
    email: string;
    reason?: string;
  };
}

/**
 * What we persist in the encrypted session cookie. Keep tight — every byte
 * is shipped on every request.
 */
export interface Session {
  user: AuthenticatedUser;
  tenant_id: TenantId;
  role: Role;
  /** Unix epoch seconds. Cookie is refreshed before this. */
  exp: number;
}

/**
 * Resolved tenant membership + role for a given WorkOS user. Returned by
 * `resolveTenantFromUser()` in `tenant.ts`.
 */
export interface TenantContext {
  tenant_id: TenantId;
  role: Role;
}
