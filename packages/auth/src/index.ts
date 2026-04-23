/**
 * packages/auth/src/index.ts
 *
 * Phase 0.4 — public surface for @christina-crm/auth.
 *
 * Stable:
 *   - types (TenantId, Role, Session, AuthenticatedUser, TenantContext)
 *   - errors (AuthError, TenantMismatchError, NotImplementedError)
 *   - session helpers (SESSION_COOKIE_NAME, getCookiePassword, isSessionFresh)
 *   - getWorkOSClient()
 *
 * Stubs (expect changes before Phase 1):
 *   - resolveTenantFromUser() — body replaced in 0.3
 *
 * Post-MVP seams (expect NotImplementedError until scheduled):
 *   - enforceMfaForTenant()
 *   - SCIM event handler (see apps/api/src/routes/webhooks/workos-scim.ts)
 */

export type {
  AuthenticatedUser,
  Role,
  Session,
  TenantContext,
  TenantId,
} from './types';
export { ROLES, asTenantId, isRole } from './types';

export { AuthError, NotImplementedError, TenantMismatchError } from './errors';

export {
  SESSION_COOKIE_NAME,
  getCookiePassword,
  getCookiePasswordKeyring,
  getSessionCookieClearOptions,
  isSessionFresh,
  decodeSession,
} from './session';

export { getWorkOSClient } from './workos-client';

export { resolveTenantFromUser } from './tenant';

export { enforceMfaForTenant } from './mfa';
