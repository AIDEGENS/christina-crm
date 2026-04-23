/**
 * packages/auth/src/workos-client.ts
 *
 * Phase 0.4 — singleton WorkOS node client (used by API side + SCIM webhook).
 *
 * The web app (apps/web) uses `@workos-inc/authkit-nextjs` helpers directly
 * because those wrap cookie/session plumbing. This file is for server-side
 * raw SDK access (directory sync, user lookup by id, etc.).
 *
 * Lazy-init so importing this module doesn't fail at build time when env
 * isn't populated (e.g., `next build` on a fresh clone without `.env`).
 */

import { WorkOS } from '@workos-inc/node';
import { AuthError } from './errors';

let _client: WorkOS | null = null;

/**
 * Returns the shared WorkOS SDK client. Throws if env is missing at call
 * time (not at import time). Call sites should handle `AuthError`.
 */
export function getWorkOSClient(): WorkOS {
  if (_client) return _client;

  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new AuthError(
      'WORKOS_API_KEY and WORKOS_CLIENT_ID must be set before calling getWorkOSClient()',
      'WORKOS_CONFIG_MISSING',
    );
  }

  _client = new WorkOS(apiKey, { clientId });
  return _client;
}

/**
 * Test-only reset hook. Keep unexported from index.ts.
 */
export function __resetWorkOSClientForTests(): void {
  _client = null;
}
