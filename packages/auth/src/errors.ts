/**
 * packages/auth/src/errors.ts
 *
 * Phase 0.4 — auth-domain error types.
 *
 * Keep this list small. Every new error class is a new branch a caller has
 * to handle; prefer reusing these over inventing new ones.
 */

export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Thrown when a user authenticated successfully against WorkOS but either:
 *   - has no tenant mapping in our DB, OR
 *   - is trying to act on a tenant they don't belong to.
 *
 * Catchers should return HTTP 403, not 401.
 */
export class TenantMismatchError extends AuthError {
  constructor(message = 'User does not belong to the requested tenant') {
    super(message, 'TENANT_MISMATCH');
    this.name = 'TenantMismatchError';
  }
}

/**
 * Intentional placeholder for post-MVP seams (MFA enforcement, JIT provision,
 * SCIM reconciliation). Throwing this makes it loud in logs if anyone calls
 * a stub in production.
 */
export class NotImplementedError extends AuthError {
  constructor(what: string) {
    super(`Not implemented: ${what}`, 'NOT_IMPLEMENTED');
    this.name = 'NotImplementedError';
  }
}
