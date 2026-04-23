/**
 * apps/api/src/middleware/require-auth.ts
 *
 * Phase 0.4 — Hono middleware that authenticates the request against the
 * shared WorkOS session cookie (same cookie the web app sets via AuthKit).
 *
 * On success, populates:
 *   c.set('user', AuthenticatedUser)
 *   c.set('tenant_id', TenantId)
 *   c.set('role', Role)
 *   c.set('impersonator', { email, reason? }) — ONLY if present in session
 *
 * On missing/invalid cookie, returns 401.
 * On valid cookie but no tenant mapping, returns 403 (TenantMismatchError).
 *
 * H-9/M3 — auth failure reasons are a closed union so metrics cardinality
 * stays bounded and a typo can't ship a new tag value.
 *
 * H-10/M1 — impersonator is stamped on c.var so every downstream handler
 * and (Phase 1) audit-log writer can attach it to every row.
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { metrics } from '@christina-crm/observability';
import {
  AuthError,
  decodeSession,
  resolveTenantFromUser,
  SESSION_COOKIE_NAME,
  TenantMismatchError,
  type AuthenticatedUser,
  type Role,
  type TenantId,
} from '@christina-crm/auth';

/**
 * Closed set of values we pass as the `reason` tag on auth-failure metrics.
 * DO NOT pass strings that aren't a member of this union — tag cardinality
 * should stay pinned.
 */
export type AuthFailureReason =
  | 'missing_session'
  | 'invalid_seal'
  | 'expired'
  | 'no_tenant'
  | 'signature_invalid';

export type Impersonator = { email: string; reason?: string };

export type AuthedEnv = {
  Variables: {
    user: AuthenticatedUser;
    tenant_id: TenantId;
    role: Role;
    impersonator?: Impersonator;
  };
};

function recordAuthFailure(reason: AuthFailureReason, impersonated: boolean): void {
  metrics.increment('crm.auth.login.failure', { reason });
  if (impersonated) {
    // Distinct counter so an impersonator session hitting 401/403 is visible
    // in Datadog without leaking identity onto the main failure counter.
    metrics.increment('crm.auth.login.failure.impersonated', { reason });
  }
}

export async function requireAuth(
  c: Context<AuthedEnv>,
  next: Next,
): Promise<Response | void> {
  const cookie = getCookie(c, SESSION_COOKIE_NAME);

  let user: AuthenticatedUser | null;
  try {
    user = await decodeSession(cookie);
  } catch (err) {
    if (err instanceof AuthError) {
      // Configuration errors (missing cookie password, missing WorkOS issuer)
      // surface as 401 to the client but are NOT logged as a normal auth miss.
      return c.json({ error: err.code, message: err.message }, 401);
    }
    throw err;
  }

  if (!user) {
    // decodeSession returns null for any of: no cookie, bad seal, bad JWT sig,
    // expired token. We don't currently distinguish — pick 'missing_session'
    // as the safe default because it's the most common case. Future: thread
    // an error reason through decodeSession to light up the other union members.
    //
    // Use the literal member — type-checker will reject a typo.
    recordAuthFailure('missing_session', false);
    return c.json({ error: 'UNAUTHENTICATED', message: 'Missing or invalid session' }, 401);
  }

  const impersonated = user.impersonator !== undefined;

  let tenant_id: TenantId;
  let role: Role;
  try {
    ({ tenant_id, role } = await resolveTenantFromUser(user));
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      recordAuthFailure('no_tenant', impersonated);
      return c.json({ error: err.code, message: err.message }, 403);
    }
    throw err;
  }

  c.set('user', user);
  c.set('tenant_id', tenant_id);
  c.set('role', role);
  if (user.impersonator) {
    c.set('impersonator', user.impersonator);
  }

  // TODO(phase-1): once the audit_log write path ships, the writer MUST
  // read c.var.impersonator and attach it to every row so HIPAA incident
  // response can distinguish real-user actions from internal operator ones.
  // See REF/CRM-08-SECURITY-HIPAA.md § Impersonation.

  await next();
}
