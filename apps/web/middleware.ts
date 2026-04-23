/**
 * apps/web/middleware.ts
 *
 * Phase 0.4 — WorkOS AuthKit middleware.
 * Phase 0.6 (H-3, 2026-04-22 review) — per-request nonce CSP in enforce mode.
 *
 * Protects every route EXCEPT the public allow-list below. Anything else
 * redirects unauthenticated users to WorkOS hosted sign-in.
 *
 * CSP strategy:
 *   - Nonce generated per request via `crypto.randomUUID()` (edge runtime OK).
 *   - Enforce mode (not Report-Only). Report-Only header was removed from
 *     vercel.json and replaced here.
 *   - `script-src` uses `'strict-dynamic'` + nonce — only scripts rendered
 *     via `<Script nonce={...} />` execute. Inline event handlers blocked.
 *   - `style-src` keeps `'unsafe-inline'` because Tailwind v3 ships inline
 *     styles. Tighten when migrating to Tailwind v4 or CSS modules.
 *   - WorkOS origins whitelisted for cdn.workos.com (client SDK), api.workos.com
 *     (form-action), and *.workos.com (AuthKit flows).
 *   - Datadog RUM origins removed — browser telemetry deferred until
 *     CloudWatch RUM is wired post-pilot. See AWS-ONLY-MIGRATION.md.
 *
 * Matcher is tuned to skip Next internals and static assets.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

const authkit = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/health',
      '/sign-in',
      '/sign-up',
      '/auth/:path*',
    ],
  },
});

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    // `'strict-dynamic'` lets scripts loaded by the nonced root script inherit trust.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.workos.com`,
    `connect-src 'self' https://api.workos.com https://*.workos.com`,
    // `'unsafe-inline'` retained for Tailwind v3; remove on v4 migration.
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    `img-src 'self' data: https://*.workos.com`,
    `font-src 'self' data:`,
    `base-uri 'self'`,
    `form-action 'self' https://api.workos.com`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  // Per-request nonce. `crypto.randomUUID()` is available in Next.js edge runtime.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // Delegate to authkit for session handling. authkitMiddleware returns a
  // NextResponse (redirect / next()). NextMiddleware signature is (req, event).
  // We don't use NextFetchEvent but its type slot is required.
  const raw = await (authkit as (r: NextRequest, e: unknown) => unknown)(req, undefined);
  const authResponse: NextResponse =
    raw instanceof NextResponse ? raw : NextResponse.next();

  // Attach CSP + nonce headers on whichever response authkit produced.
  authResponse.headers.set('Content-Security-Policy', csp);
  authResponse.headers.set('x-nonce', nonce);
  return authResponse;
}

export const config = {
  matcher: [
    // Match everything except Next.js internals, static assets, and api
    // health checks. API webhook routes live under apps/api and aren't
    // affected by this matcher.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
