/**
 * packages/auth/src/tenant.test.ts
 *
 * Unit tests for `assertDevAuthNotInProd()` in tenant.ts.
 *
 * NOTE: tenant.ts calls `assertDevAuthNotInProd()` at module load time.
 * To test the function in isolation we import it directly and re-invoke it
 * after manipulating `process.env`. We save + restore NODE_ENV and
 * DEV_AUTH_* vars in beforeEach/afterEach so tests don't bleed state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthError } from './errors';
// Note: tenant.ts calls assertDevAuthNotInProd() at module load. The import
// is hoisted and executes before any test hook. In vitest, NODE_ENV is
// typically 'test' and DEV_AUTH_* are absent, so the module-load call is safe.
// Tests re-invoke the function after manipulating env per case.
import { assertDevAuthNotInProd } from './tenant';

// ── env state helpers ─────────────────────────────────────────────────────────

type SavedEnv = {
  NODE_ENV: string | undefined;
  DEV_AUTH_TENANT_ID: string | undefined;
  DEV_AUTH_ROLE: string | undefined;
};

let saved: SavedEnv;

beforeEach(() => {
  saved = {
    NODE_ENV: process.env['NODE_ENV'],
    DEV_AUTH_TENANT_ID: process.env['DEV_AUTH_TENANT_ID'],
    DEV_AUTH_ROLE: process.env['DEV_AUTH_ROLE'],
  };
  // Clear DEV_AUTH_* by default so tests start from a clean baseline.
  delete process.env['DEV_AUTH_TENANT_ID'];
  delete process.env['DEV_AUTH_ROLE'];
});

afterEach(() => {
  for (const [key, val] of Object.entries(saved)) {
    if (val === undefined) {
      delete process.env[key as keyof SavedEnv];
    } else {
      process.env[key as keyof SavedEnv] = val;
    }
  }
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('assertDevAuthNotInProd', () => {
  it('does not throw when NODE_ENV=production and no DEV_AUTH vars are set', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['DEV_AUTH_TENANT_ID'];
    delete process.env['DEV_AUTH_ROLE'];
    expect(() => assertDevAuthNotInProd()).not.toThrow();
  });

  it('throws AuthError with code DEV_SHIM_IN_PROD when production + DEV_AUTH_TENANT_ID is set', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DEV_AUTH_TENANT_ID'] = 'some-tenant-id';
    delete process.env['DEV_AUTH_ROLE'];
    expect(() => assertDevAuthNotInProd()).toThrow(AuthError);
    try {
      assertDevAuthNotInProd();
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe('DEV_SHIM_IN_PROD');
      expect((e as AuthError).message).toContain('DEV_AUTH_TENANT_ID');
    }
  });

  it('throws AuthError with code DEV_SHIM_IN_PROD when production + DEV_AUTH_ROLE is set', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['DEV_AUTH_TENANT_ID'];
    process.env['DEV_AUTH_ROLE'] = 'admin';
    expect(() => assertDevAuthNotInProd()).toThrow(AuthError);
    try {
      assertDevAuthNotInProd();
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe('DEV_SHIM_IN_PROD');
    }
  });

  it('does not throw when NODE_ENV=development and both DEV_AUTH vars are set', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DEV_AUTH_TENANT_ID'] = 'dev-tenant-id';
    process.env['DEV_AUTH_ROLE'] = 'admin';
    expect(() => assertDevAuthNotInProd()).not.toThrow();
  });

  it('does not throw when NODE_ENV=test and both DEV_AUTH vars are set', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['DEV_AUTH_TENANT_ID'] = 'test-tenant-id';
    process.env['DEV_AUTH_ROLE'] = 'clinician';
    expect(() => assertDevAuthNotInProd()).not.toThrow();
  });

  it('does not throw but calls console.warn when NODE_ENV is undefined and DEV_AUTH is set', () => {
    delete process.env['NODE_ENV'];
    process.env['DEV_AUTH_TENANT_ID'] = 'some-tenant-id';
    process.env['DEV_AUTH_ROLE'] = 'admin';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => assertDevAuthNotInProd()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/DEV_AUTH/);
  });

  it('error has correct code and message content', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DEV_AUTH_TENANT_ID'] = 'leaking-tenant';
    let caught: unknown;
    try {
      assertDevAuthNotInProd();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    expect(err.code).toBe('DEV_SHIM_IN_PROD');
    expect(err.name).toBe('AuthError');
    expect(err.message).toMatch(/production/);
  });
});
