/**
 * apps/api/src/middleware/require-origin.ts
 *
 * H-5 / CSRF gate for cookie-authenticated API routes.
 *
 * Cookie auth alone is vulnerable to CSRF: any third-party site can make the
 * browser send our `wos-session` cookie on a cross-origin request. SameSite=strict
 * closes most of this gap, but we add an Origin/Referer check as belt-and-suspenders
 * because (a) older browsers, (b) server-side rewrites, and (c) the WEB app
 * may need a non-strict cookie later (see comment in session.ts).
 *
 * Contract:
 *   - `ALLOWED_ORIGINS` env var, comma-separated, exact-match. No wildcards.
 *   - If the request has an `origin` header, it must appear in the list.
 *   - Else if it has a `referer` header, its origin must appear in the list.
 *   - Else (both missing) → 403.
 *
 * This middleware runs BEFORE `requireAuth` on `/v1/*` so that CSRF attempts
 * never even hit the cookie decode path.
 */

import type { Context, Next } from 'hono';

const ALLOWED_ORIGINS_ENV = 'ALLOWED_ORIGINS';

function parseAllowed(): string[] {
  const raw = process.env[ALLOWED_ORIGINS_ENV] ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function refererOrigin(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export async function requireOrigin(c: Context, next: Next): Promise<Response | void> {
  const allowed = parseAllowed();
  if (allowed.length === 0) {
    // Fail closed: an unconfigured allowlist in prod is a misconfiguration,
    // not a license to accept anything. Local dev must set ALLOWED_ORIGINS
    // (see .env.example).
    return c.json(
      { error: 'CSRF', message: 'ALLOWED_ORIGINS not configured' },
      403,
    );
  }

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const candidate = origin ?? (referer ? refererOrigin(referer) : null);

  if (!candidate || !allowed.includes(candidate)) {
    return c.json({ error: 'CSRF', message: 'Disallowed origin' }, 403);
  }

  await next();
}
