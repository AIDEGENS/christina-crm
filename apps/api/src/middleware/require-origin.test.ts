/**
 * apps/api/src/middleware/require-origin.test.ts
 *
 * Unit tests for the requireOrigin CSRF-gate middleware.
 *
 * Strategy:
 *   - stub `ALLOWED_ORIGINS` via process.env per test
 *   - exercise every branch: valid origin, blocked origin, referer fallback,
 *     no headers, empty allowlist, whitespace/trailing-comma parsing, malformed
 *     referer URL
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requireOrigin } from './require-origin.js';

// ── test app factory ──────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.use('*', requireOrigin);
  app.get('/ping', (c) => c.json({ ok: true }));
  return app;
}

type JsonBody = Record<string, unknown>;

async function get(
  app: ReturnType<typeof makeApp>,
  headers: Record<string, string> = {},
) {
  return app.request('/ping', { headers });
}

// ── env management ────────────────────────────────────────────────────────────

let savedAllowedOrigins: string | undefined;

beforeEach(() => {
  savedAllowedOrigins = process.env['ALLOWED_ORIGINS'];
});

afterEach(() => {
  if (savedAllowedOrigins === undefined) {
    delete process.env['ALLOWED_ORIGINS'];
  } else {
    process.env['ALLOWED_ORIGINS'] = savedAllowedOrigins;
  }
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('requireOrigin', () => {
  it('passes when origin is in the allowlist', async () => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    const app = makeApp();
    const res = await get(app, { origin: 'http://localhost:3000' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body['ok']).toBe(true);
  });

  it('returns 403 with CSRF error when origin is not in allowlist', async () => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    const app = makeApp();
    const res = await get(app, { origin: 'https://evil.example.com' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body['error']).toBe('CSRF');
  });

  it('passes when no origin header but referer origin is in allowlist', async () => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    const app = makeApp();
    const res = await get(app, { referer: 'http://localhost:3000/some/path' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body['ok']).toBe(true);
  });

  it('returns 403 when no origin and no referer are present', async () => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    const app = makeApp();
    const res = await get(app); // no headers
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body['error']).toBe('CSRF');
  });

  it('returns 403 fail-closed when ALLOWED_ORIGINS is empty string', async () => {
    process.env['ALLOWED_ORIGINS'] = '';
    const app = makeApp();
    const res = await get(app, { origin: 'http://localhost:3000' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body['error']).toBe('CSRF');
  });

  it('returns 403 fail-closed when ALLOWED_ORIGINS env var is not set', async () => {
    delete process.env['ALLOWED_ORIGINS'];
    const app = makeApp();
    const res = await get(app, { origin: 'http://localhost:3000' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body['error']).toBe('CSRF');
  });

  it('parses ALLOWED_ORIGINS with whitespace and trailing commas correctly', async () => {
    // Whitespace around entries and a trailing comma must be trimmed + filtered
    process.env['ALLOWED_ORIGINS'] = ' http://localhost:3000 , https://app.example.com , ';
    const app = makeApp();

    const res1 = await get(app, { origin: 'http://localhost:3000' });
    expect(res1.status).toBe(200);

    const res2 = await get(app, { origin: 'https://app.example.com' });
    expect(res2.status).toBe(200);

    const res3 = await get(app, { origin: 'http://evil.example.com' });
    expect(res3.status).toBe(403);
  });

  it('returns 403 when referer is a malformed URL (new URL() throws)', async () => {
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
    const app = makeApp();
    // Malformed referer that `new URL()` cannot parse
    const res = await get(app, { referer: 'not-a-valid-url' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as JsonBody;
    expect(body['error']).toBe('CSRF');
  });
});
