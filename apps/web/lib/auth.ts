/**
 * apps/web/lib/auth.ts
 *
 * Phase 0.4 — web-side auth helpers.
 *
 * Re-exports the stable surface from `@christina-crm/auth` plus a
 * `getCurrentUser()` server helper that bundles WorkOS's `withAuth()` and
 * our tenant resolver into one call. Use this in server components /
 * route handlers instead of wiring the two separately.
 */

import { withAuth } from '@workos-inc/authkit-nextjs';
import {
  resolveTenantFromUser,
  type AuthenticatedUser,
  type Role,
  type TenantId,
} from '@christina-crm/auth';

export {
  asTenantId,
  AuthError,
  isRole,
  ROLES,
  SESSION_COOKIE_NAME,
  TenantMismatchError,
  type AuthenticatedUser,
  type Role,
  type Session,
  type TenantContext,
  type TenantId,
} from '@christina-crm/auth';

export interface CurrentUserPayload {
  user: AuthenticatedUser;
  tenant_id: TenantId;
  role: Role;
}

/**
 * Server-only helper. Must be called from a server component, route
 * handler, or server action — NEVER from a client component.
 *
 * Redirects to /sign-in if the session is missing or expired.
 * Throws `TenantMismatchError` if authenticated but no tenant mapping.
 */
export async function getCurrentUser(): Promise<CurrentUserPayload> {
  const { user } = await withAuth({ ensureSignedIn: true });

  const authedUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    ...(user.firstName ? { first_name: user.firstName } : {}),
    ...(user.lastName ? { last_name: user.lastName } : {}),
  };

  const { tenant_id, role } = await resolveTenantFromUser(authedUser);
  return { user: authedUser, tenant_id, role };
}
