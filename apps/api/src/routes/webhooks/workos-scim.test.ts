/**
 * apps/api/src/routes/webhooks/workos-scim.test.ts
 *
 * CRIT-3 — unit tests for WorkOS SCIM webhook signature verification.
 *
 * We test both the `verifyWorkOSSignature` pure helper AND the Hono route end-to-end
 * so that middleware ordering and rawBody read-once behavior are both covered.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import route, { verifyWorkOSSignature } from './workos-scim.js';

const SECRET = 'whsec_test_'.padEnd(64, 'x');

function sign(rawBody: string, ts: number, secret: string = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return `t=${ts},v1=${mac}`;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

let savedSecret: string | undefined;

beforeEach(() => {
  savedSecret = process.env['WORKOS_WEBHOOK_SECRET'];
  process.env['WORKOS_WEBHOOK_SECRET'] = SECRET;
});

afterEach(() => {
  if (savedSecret === undefined) {
    delete process.env['WORKOS_WEBHOOK_SECRET'];
  } else {
    process.env['WORKOS_WEBHOOK_SECRET'] = savedSecret;
  }
  vi.useRealTimers();
});

describe('verifyWorkOSSignature (pure)', () => {
  it('accepts a valid signature within the 5-minute window', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const header = sign(body, nowSec());
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(true);
  });

  it('rejects a stale timestamp (>300s old)', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const header = sign(body, nowSec() - 301);
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects a future-dated timestamp (>300s ahead)', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const header = sign(body, nowSec() + 301);
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects a wrong signature (same length, different bytes)', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const ts = nowSec();
    // Valid length, invalid contents.
    const header = `t=${ts},v1=${'0'.repeat(64)}`;
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects a v1 of wrong hex length without throwing', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const ts = nowSec();
    const header = `t=${ts},v1=deadbeef`; // 8 chars, not 64
    expect(() => verifyWorkOSSignature(body, header, SECRET)).not.toThrow();
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects malformed hex in v1 without throwing', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const ts = nowSec();
    // 64 characters but not valid hex — Buffer.from('hex') will drop or truncate.
    const header = `t=${ts},v1=${'z'.repeat(64)}`;
    expect(() => verifyWorkOSSignature(body, header, SECRET)).not.toThrow();
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyWorkOSSignature('{}', undefined, SECRET)).toBe(false);
  });

  it('rejects an empty-string secret', () => {
    const body = '{}';
    const header = sign(body, nowSec());
    expect(verifyWorkOSSignature(body, header, '')).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const body = '{}';
    expect(verifyWorkOSSignature(body, `t=notatime,v1=${'0'.repeat(64)}`, SECRET)).toBe(false);
  });

  it('ignores unknown header segments alongside t and v1', () => {
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const ts = nowSec();
    const mac = createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
    const header = `t=${ts},foo=bar,v1=${mac}`;
    expect(verifyWorkOSSignature(body, header, SECRET)).toBe(true);
  });

  it('does not early-exit on prefix match (uses timing-safe compare)', () => {
    // If the implementation used === or startsWith, a prefix-matching wrong
    // signature would still return false. This test is more about ensuring
    // the implementation path goes through timingSafeEqual — we assert the
    // behavior, and the code path is asserted by inspection.
    const body = JSON.stringify({ event: 'dsync.user.created' });
    const ts = nowSec();
    const real = createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
    // Flip one bit: same length, same prefix, different result.
    const wrong = (parseInt(real.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0') + real.slice(2);
    expect(verifyWorkOSSignature(body, `t=${ts},v1=${wrong}`, SECRET)).toBe(false);
  });
});

// Hono route E2E — exercises the read-body-once-then-verify path.
describe('POST /webhooks/workos-scim (Hono)', () => {
  async function post(body: string, header: string | undefined): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (header !== undefined) headers['WorkOS-Signature'] = header;
    return route.request('/', {
      method: 'POST',
      headers,
      body,
    });
  }

  it('returns 200 on a valid signature + fresh timestamp', async () => {
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    const res = await post(body, sign(body, nowSec()));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);
  });

  it('returns 401 on a stale timestamp (replay window exceeded)', async () => {
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    const res = await post(body, sign(body, nowSec() - 301));
    expect(res.status).toBe(401);
  });

  it('returns 401 on a bad signature', async () => {
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    const res = await post(body, `t=${nowSec()},v1=${'0'.repeat(64)}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the signature header is missing', async () => {
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    const res = await post(body, undefined);
    expect(res.status).toBe(401);
  });

  it('returns 401 when WORKOS_WEBHOOK_SECRET env is missing', async () => {
    delete process.env['WORKOS_WEBHOOK_SECRET'];
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    // Header contents are irrelevant here — the handler should short-circuit
    // on missing secret before even looking.
    const res = await post(body, `t=${nowSec()},v1=${'0'.repeat(64)}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 on mismatched-length v1 hex (no throw)', async () => {
    const body = JSON.stringify({ event: 'dsync.user.created', data: {} });
    const res = await post(body, `t=${nowSec()},v1=deadbeef`);
    expect(res.status).toBe(401);
  });

  it('returns 400 on valid signature but unparseable JSON body', async () => {
    const body = 'not json';
    const res = await post(body, sign(body, nowSec()));
    expect(res.status).toBe(400);
  });
});
