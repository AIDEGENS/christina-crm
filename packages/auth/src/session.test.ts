/**
 * packages/auth/src/session.test.ts
 *
 * Unit tests for `getCookiePasswordKeyring()` and `getCookiePassword()` in
 * session.ts.
 *
 * Strategy:
 *   - manipulate WORKOS_COOKIE_PASSWORD and WORKOS_COOKIE_PASSWORD_KEYRING per
 *     test; restore originals in afterEach
 *   - verify all success paths and every throw branch
 *   - verify getCookiePassword numeric sort (1 < 2 < 10)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthError } from './errors';
import { getCookiePasswordKeyring, getCookiePassword } from './session';

// ── env management ────────────────────────────────────────────────────────────

type SavedEnv = {
  WORKOS_COOKIE_PASSWORD: string | undefined;
  WORKOS_COOKIE_PASSWORD_KEYRING: string | undefined;
};

let saved: SavedEnv;

beforeEach(() => {
  saved = {
    WORKOS_COOKIE_PASSWORD: process.env['WORKOS_COOKIE_PASSWORD'],
    WORKOS_COOKIE_PASSWORD_KEYRING: process.env['WORKOS_COOKIE_PASSWORD_KEYRING'],
  };
  // Reset both vars before each test
  delete process.env['WORKOS_COOKIE_PASSWORD'];
  delete process.env['WORKOS_COOKIE_PASSWORD_KEYRING'];
});

afterEach(() => {
  for (const [key, val] of Object.entries(saved)) {
    if (val === undefined) {
      delete process.env[key as keyof SavedEnv];
    } else {
      process.env[key as keyof SavedEnv] = val;
    }
  }
});

// ── password helpers ──────────────────────────────────────────────────────────

/** Generate a string of the given length filled with a repeated char. */
function pwd(length: number, char = 'a'): string {
  return char.repeat(length);
}

// ── getCookiePasswordKeyring tests ────────────────────────────────────────────

describe('getCookiePasswordKeyring', () => {
  it('returns single-version keyring from valid WORKOS_COOKIE_PASSWORD_KEYRING JSON', () => {
    const p = pwd(32, 'x');
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify({ '1': p });
    const kr = getCookiePasswordKeyring();
    expect(kr).toEqual({ '1': p });
  });

  it('returns multi-version keyring when multiple versions present', () => {
    const p1 = pwd(32, 'a');
    const p2 = pwd(36, 'b');
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify({ '1': p1, '2': p2 });
    const kr = getCookiePasswordKeyring();
    expect(kr['1']).toBe(p1);
    expect(kr['2']).toBe(p2);
  });

  it('throws AuthError COOKIE_PASSWORD_INVALID for malformed JSON', () => {
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = '{not valid json';
    expect(() => getCookiePasswordKeyring()).toThrow(AuthError);
    try {
      getCookiePasswordKeyring();
    } catch (e) {
      expect((e as AuthError).code).toBe('COOKIE_PASSWORD_INVALID');
    }
  });

  it('throws AuthError COOKIE_PASSWORD_INVALID when JSON is a bare string (non-object)', () => {
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify('bare-string');
    expect(() => getCookiePasswordKeyring()).toThrow(AuthError);
    try {
      getCookiePasswordKeyring();
    } catch (e) {
      expect((e as AuthError).code).toBe('COOKIE_PASSWORD_INVALID');
    }
  });

  it('throws AuthError COOKIE_PASSWORD_INVALID when a version value is shorter than 32 chars', () => {
    const short = pwd(31, 'z');
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify({ '1': short });
    expect(() => getCookiePasswordKeyring()).toThrow(AuthError);
    try {
      getCookiePasswordKeyring();
    } catch (e) {
      expect((e as AuthError).code).toBe('COOKIE_PASSWORD_INVALID');
    }
  });

  it('throws AuthError COOKIE_PASSWORD_MISSING when neither keyring nor single password is set', () => {
    delete process.env['WORKOS_COOKIE_PASSWORD'];
    delete process.env['WORKOS_COOKIE_PASSWORD_KEYRING'];
    expect(() => getCookiePasswordKeyring()).toThrow(AuthError);
    try {
      getCookiePasswordKeyring();
    } catch (e) {
      expect((e as AuthError).code).toBe('COOKIE_PASSWORD_MISSING');
    }
  });

  it('throws AuthError COOKIE_PASSWORD_MISSING when WORKOS_COOKIE_PASSWORD is shorter than 32 chars', () => {
    process.env['WORKOS_COOKIE_PASSWORD'] = pwd(31);
    expect(() => getCookiePasswordKeyring()).toThrow(AuthError);
    try {
      getCookiePasswordKeyring();
    } catch (e) {
      expect((e as AuthError).code).toBe('COOKIE_PASSWORD_MISSING');
    }
  });
});

// ── getCookiePassword version selection tests ─────────────────────────────────

describe('getCookiePassword', () => {
  it('returns the highest-numbered version when keyring has versions 1, 2, 10', () => {
    const p1 = pwd(32, 'a');
    const p2 = pwd(32, 'b');
    const p10 = pwd(32, 'c');
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify({
      '1': p1,
      '2': p2,
      '10': p10,
    });
    // Numeric sort: 10 > 2 > 1 — must not use lexicographic ('2' > '10')
    const result = getCookiePassword();
    expect(result).toBe(p10);
  });

  it('returns the single version value when keyring has only one version', () => {
    const p = pwd(40, 'd');
    process.env['WORKOS_COOKIE_PASSWORD_KEYRING'] = JSON.stringify({ '1': p });
    expect(getCookiePassword()).toBe(p);
  });
});
