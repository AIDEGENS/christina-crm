/**
 * apps/api/src/routes/webhooks/workos-scim.ts
 *
 * Phase 0.4 — WorkOS directory sync (SCIM) webhook endpoint.
 *
 * SCIM events from WorkOS arrive here. Phase 0.4 performs real HMAC-SHA256
 * signature verification + a 5-minute replay window, then logs the event
 * without applying state. Registering the webhook in the WorkOS dashboard is
 * safe, and anyone scraping the URL gets a 401 without an early-exit timing
 * leak.
 *
 * TODO(post-mvp): Wire directory sync — user provisioning, deprovisioning,
 * group → role mapping. See REF/CRM-04-ARCHITECTURE.md § Directory Sync for
 * the model.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';

const route = new Hono();

/**
 * Replay window (seconds). WorkOS-signed timestamps older than this are
 * rejected even if the HMAC is valid, to bound the window a replayed body
 * can be accepted. 5 minutes matches WorkOS + Stripe + Slack convention.
 */
const REPLAY_WINDOW_SEC = 5 * 60;

/**
 * Verify WorkOS webhook signature. WorkOS signs `${timestamp}.${rawBody}`
 * with HMAC-SHA256 using `WORKOS_WEBHOOK_SECRET` and puts the result in a
 * `WorkOS-Signature` header shaped like `t=1710000000,v1=abc123...`.
 *
 * Reference: https://workos.com/docs/events/data-syncing/webhooks/signatures
 *
 * Contract (hard rules):
 *   - No early exit on mismatch — use timingSafeEqual to block timing oracles.
 *   - Compare hex strings via buffers of EQUAL length only (timingSafeEqual
 *     throws on length mismatch; we catch and return false).
 *   - Reject if ts is outside [now-300, now+300].
 *   - Reject if header or secret is missing.
 */
export function verifyWorkOSSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;

  // Parse "t=...,v1=..." into { t, v1 }. Ignore unknown keys.
  const parts: Record<string, string> = {};
  for (const segment of header.split(',')) {
    const eq = segment.indexOf('=');
    if (eq <= 0) continue;
    const k = segment.slice(0, eq).trim();
    const v = segment.slice(eq + 1).trim();
    if (k.length > 0) parts[k] = v;
  }

  const ts = Number(parts['t']);
  if (!Number.isFinite(ts)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SEC) return false;

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const given = (parts['v1'] ?? '').toLowerCase();

  // Buffer.from / timingSafeEqual both reject length-mismatched inputs. We
  // short-circuit on length BEFORE timingSafeEqual to avoid the throw path
  // becoming the timing oracle itself.
  if (given.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(given, 'hex'),
    );
  } catch {
    // Malformed hex in the given sig → treat as invalid, not a 500.
    return false;
  }
}

/**
 * Stub SCIM event handler. Receives a parsed event, does nothing, returns
 * void. Replace with a real reducer when directory sync ships.
 */
async function onScimEvent(_event: unknown): Promise<void> {
  // TODO(post-mvp): route events:
  //   - dsync.user.created       -> upsert user, upsert tenant_members row
  //   - dsync.user.updated       -> update email/name
  //   - dsync.user.deleted       -> soft-delete tenant_members row
  //   - dsync.group.user_added   -> update role mapping
  //   - dsync.group.user_removed -> revoke role
}

route.post('/', async (c) => {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;
  if (!secret) {
    // Missing server-side secret is a misconfiguration. Keep the 401 shape
    // for unauthenticated callers (no info leak about config state).
    return c.json({ error: 'INVALID_SIGNATURE' }, 401);
  }

  // Read the raw body ONCE — we need the exact bytes WorkOS signed, so we
  // cannot let Hono re-parse it. Pass the same string to verify and JSON.parse.
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('WorkOS-Signature');

  const ok = verifyWorkOSSignature(rawBody, signatureHeader, secret);
  if (!ok) {
    return c.json({ error: 'INVALID_SIGNATURE' }, 401);
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'INVALID_JSON' }, 400);
  }

  await onScimEvent(event);

  // Always 200 once signature passes — WorkOS retries non-2xx aggressively.
  return c.json({ received: true });
});

export default route;
