/**
 * apps/api/src/middleware/require-auth.test.ts
 *
 * Unit tests for the requireAuth Hono middleware.
 *
 * Strategy:
 *   - mock `@christina-crm/auth` directly so we control decodeSession +
 *     resolveTenantFromUser at the workspace-package boundary. The alternative
 *     (mocking iron-session + jose) does not reach across the vitest monorepo
 *     module-resolution boundary — the auth package holds its own resolved
 *     copies of those deps, so the test-file-scoped mocks never fire inside
 *     `decodeSession`. Mocking the public surface instead is both the
 *     correct unit-test seam AND the only approach that works in this repo.
 *   - production path is unchanged: real `decodeSession` still uses real
 *     iron-session + jose JWKS. Only tests use mocks.
 *   - tenant resolution is also mocked so the test doesn't depend on
 *     `DEV_AUTH_TENANT_ID` shim env vars.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { AuthedEnv } from './require-auth.js';
import { requireAuth } from './require-auth.js';

// ── @christina-crm/auth mock ─────────────────────────────────────────────────
// We mock the public surface consumed by require-auth.ts. Error classes are
// re-exported from the real module via `importOriginal` so `instanceof` checks
// in the middleware keep working.
vi.mock('@christina-crm/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@christina-crm/auth')>();
  return {
    ...actual,
    decodeSession: vi.fn(),
    resolveTenantFromUser: vi.fn(),
  };
});

import { decodeSession, resolveTenantFromUser, AuthError, TenantMismatchError, asTenantId } from '@christina-crm/auth';
const mockDecodeSession = vi.mocked(decodeSession);
const mockResolveTenant = vi.mocked(resolveTenantFromUser);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build an AuthenticatedUser fixture. */
function makeUser(overrides: Partial<{ impersonator: { email: string; reason?: string } }> = {}) {
  return {
    id: 'user_01HZTEST',
    email: 'test@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    ...overrides,
  };
}

// ── test app factory ──────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono<AuthedEnv>();
  app.use('*', requireAuth);
  app.get('/ping', (c) => {
    const user = c.get('user');
    return c.json({ ok: true, userId: user.id, email: user.email });
  });
  return app;
}

/** Make a request to the test app, optionally including a cookie header. */
async function request(app: ReturnType<typeof makeApp>, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) {
    headers['Cookie'] = `wos-session=${cookieValue}`;
  }
  return app.request('/ping', { headers });
}

// ── env setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: resolveTenantFromUser returns a valid tenant/role. Individual
  // tests can override with mockRejectedValueOnce for the no-tenant path.
  mockResolveTenant.mockResolvedValue({
    tenant_id: asTenantId('tenant_01HZTEST'),
    role: 'admin',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns 401 when no cookie is present', async () => {
    mockDecodeSession.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when cookie seal is invalid (decodeSession returns null)', async () => {
    mockDecodeSession.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app, 'bad_seal_value');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when access token signature verify fails (decodeSession returns null)', async () => {
    mockDecodeSession.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app, 'valid_seal_bad_sig');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when access token is expired (decodeSession returns null)', async () => {
    mockDecodeSession.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await request(app, 'valid_but_expired_seal');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHENTICATED');
  });

  it('calls next() and sets user/tenant/role in context on valid session', async () => {
    mockDecodeSession.mockResolvedValueOnce(makeUser());
    const app = makeApp();
    const res = await request(app, 'valid_seal');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; userId: string; email: string };
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('user_01HZTEST');
    expect(body.email).toBe('test@example.com');
  });

  it('returns 401 with COOKIE_PASSWORD_MISSING when decodeSession throws that AuthError', async () => {
    mockDecodeSession.mockRejectedValueOnce(
      new AuthError('cookie password missing', 'COOKIE_PASSWORD_MISSING'),
    );
    const app = makeApp();
    const res = await request(app, 'some_seal');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('COOKIE_PASSWORD_MISSING');
  });

  it('returns 401 with WORKOS_CONFIG_MISSING when decodeSession throws that AuthError', async () => {
    mockDecodeSession.mockRejectedValueOnce(
      new AuthError('workos config missing', 'WORKOS_CONFIG_MISSING'),
    );
    const app = makeApp();
    const res = await request(app, 'valid_seal_bad_config');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('WORKOS_CONFIG_MISSING');
  });

  it('returns 403 when user has no tenant mapping', async () => {
    mockDecodeSession.mockResolvedValueOnce(makeUser());
    mockResolveTenant.mockReset();
    mockResolveTenant.mockRejectedValueOnce(
      new TenantMismatchError('No tenant mapping for WorkOS user user_01HZTEST'),
    );
    const app = makeApp();
    const res = await request(app, 'valid_seal_no_tenant');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('TENANT_MISMATCH');
  });

  it('propagates impersonator from the session onto c.var', async () => {
    mockDecodeSession.mockResolvedValueOnce(
      makeUser({ impersonator: { email: 'admin@example.com', reason: 'support ticket 123' } }),
    );

    const app = new Hono<AuthedEnv>();
    app.use('*', requireAuth);
    app.get('/ping', (c) => {
      const imp = c.get('impersonator');
      return c.json({ ok: true, imp });
    });

    const res = await app.request('/ping', {
      headers: { Cookie: 'wos-session=valid_seal_impersonated' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; imp?: { email: string; reason?: string } };
    expect(body.imp).toBeDefined();
    expect(body.imp?.email).toBe('admin@example.com');
    expect(body.imp?.reason).toBe('support ticket 123');
  });
});
