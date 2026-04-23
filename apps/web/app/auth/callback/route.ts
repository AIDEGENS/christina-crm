/**
 * apps/web/app/auth/callback/route.ts
 *
 * Phase 0.4 — WorkOS AuthKit OAuth callback.
 *
 * The AuthKit helper reads the `code` query param, exchanges it for a session
 * at WorkOS, sets the signed+encrypted cookie, and redirects into the app.
 * We delegate entirely to `handleAuth()` — do not roll custom exchange logic.
 *
 * Post-auth landing page is `/dashboard`. If the user has no tenant mapping,
 * `resolveTenantFromUser()` will throw and the dashboard server component
 * will render an error state (Phase 0.5 adds a dedicated /no-tenant page).
 */

import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth({
  returnPathname: '/dashboard',
});
