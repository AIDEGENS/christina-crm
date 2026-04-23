/**
 * apps/web/app/sign-out/route.ts
 *
 * Phase 0.4 — POST /sign-out clears the session and returns the user home.
 *
 * Using POST (not GET) prevents drive-by logout via prefetch or image tags.
 * AuthKit's `signOut()` clears the cookie and, if configured, hits WorkOS
 * to invalidate the session at the IdP.
 */

import { signOut } from '@workos-inc/authkit-nextjs';

export async function POST(): Promise<Response> {
  await signOut();
  // signOut() throws a redirect internally; this return is unreachable but
  // satisfies the Next.js route handler type.
  return new Response(null, { status: 302, headers: { Location: '/' } });
}
