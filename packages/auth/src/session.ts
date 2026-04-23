/**
 * packages/auth/src/session.ts
 *
 * Phase 0.4 — encrypted session cookie helpers.
 *
 * The WEB app uses `@workos-inc/authkit-nextjs` (middleware + withAuth) which
 * owns cookie format on the Next.js side. This module re-exports the shared
 * cookie name + env-var contract so the API (Hono) can read the same cookie
 * in `require-auth.ts`.
 *
 * Cookie contract:
 *   - name:     wos-session (default from authkit-nextjs)
 *   - httpOnly: true
 *   - secure:   true (false in local dev when NODE_ENV=development)
 *   - sameSite: strict (API-read flow). See note in `getSessionCookieClearOptions`
 *     re: potential WEB-vs-API split if the top-level WorkOS callback redirect
 *     cannot round-trip a strict cookie. Defer the split to 1.1 if it breaks.
 *   - signed + encrypted w/ WORKOS_COOKIE_PASSWORD (>=32 chars)
 *   - supports keyring rotation via WORKOS_COOKIE_PASSWORD_KEYRING (see below)
 *
 * `decodeSession` unseals the iron-session payload that `authkit-nextjs` writes,
 * then verifies the access-token JWT against the WorkOS JWKS (issuer, audience,
 * signature) and uses the verified `exp` claim for the freshness check. It is
 * the single decode path for the Hono API; the Next.js web app continues to
 * use authkit's own helpers.
 *
 * Do NOT roll your own crypto here — defer to iron-session for unseal and jose
 * for JWT verify.
 */

import { unsealData } from 'iron-session';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthenticatedUser, Session } from './types';
import { AuthError } from './errors';

export const SESSION_COOKIE_NAME = 'wos-session';

/**
 * Cookie password keyring type. Keys are version labels ('1', '2', ...),
 * values are the password strings. iron-session v8 supports version-mapped
 * passwords natively: seal uses the highest-numbered key, unseal tries all.
 */
type CookiePasswordKeyring = { [version: string]: string };

/**
 * Returns the cookie-password keyring from env or throws.
 *
 * Two env-var shapes supported:
 *   - `WORKOS_COOKIE_PASSWORD_KEYRING` — JSON object, e.g. `{"1":"...","2":"..."}`.
 *     iron-session will try every entry on unseal and use the highest on seal.
 *     Use this for rotation: add a new version, deploy, drop the old after 7 days.
 *   - `WORKOS_COOKIE_PASSWORD` — single string, wrapped as `{ "1": value }`.
 *     Legacy single-password flow; still supported for dev.
 *
 * If both are set, KEYRING wins. Every value must be >=32 chars.
 */
export function getCookiePasswordKeyring(): CookiePasswordKeyring {
  const keyring = process.env.WORKOS_COOKIE_PASSWORD_KEYRING;
  if (keyring) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(keyring);
    } catch {
      throw new AuthError(
        'WORKOS_COOKIE_PASSWORD_KEYRING is not valid JSON',
        'COOKIE_PASSWORD_INVALID',
      );
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new AuthError(
        'WORKOS_COOKIE_PASSWORD_KEYRING must be a JSON object of version -> password',
        'COOKIE_PASSWORD_INVALID',
      );
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) {
      throw new AuthError(
        'WORKOS_COOKIE_PASSWORD_KEYRING is empty',
        'COOKIE_PASSWORD_INVALID',
      );
    }
    const result: CookiePasswordKeyring = {};
    for (const [version, value] of entries) {
      if (typeof value !== 'string' || value.length < 32) {
        throw new AuthError(
          `WORKOS_COOKIE_PASSWORD_KEYRING[${version}] must be a string of at least 32 chars`,
          'COOKIE_PASSWORD_INVALID',
        );
      }
      result[version] = value;
    }
    return result;
  }

  const single = process.env.WORKOS_COOKIE_PASSWORD;
  if (!single || single.length < 32) {
    throw new AuthError(
      'WORKOS_COOKIE_PASSWORD must be set and at least 32 chars. Generate with: openssl rand -hex 32',
      'COOKIE_PASSWORD_MISSING',
    );
  }
  return { '1': single };
}

/**
 * Returns the cookie-signing password from env or throws. Centralised so
 * we only check one place and every consumer fails the same way.
 *
 * Prefers the keyring if present (picks the highest-numbered version for
 * seal operations). Callers that only need to unseal should prefer
 * `getCookiePasswordKeyring()` and pass the whole map to iron-session.
 */
export function getCookiePassword(): string {
  const keyring = getCookiePasswordKeyring();
  // Highest-numbered key wins for seal. Lexicographic sort works for numeric
  // string keys ('1','2',...,'10') only if callers zero-pad; safer to compare
  // numerically where possible and fall back to lexicographic.
  const versions = Object.keys(keyring);
  versions.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const highest = versions[versions.length - 1] as string;
  return keyring[highest] as string;
}

/**
 * Verifies a session TTL in Unix seconds. Returns false if expired or
 * missing/malformed.
 */
export function isSessionFresh(session: Pick<Session, 'exp'> | null | undefined): boolean {
  if (!session) return false;
  const now = Math.floor(Date.now() / 1000);
  return typeof session.exp === 'number' && session.exp > now;
}

/**
 * Convenience: default cookie options used when the API needs to clear the
 * session cookie (logout from an API-only client).
 *
 * NOTE: sameSite is 'strict' for the API-read flow to close the CSRF gap on
 * cookie-auth endpoints under /v1/*. The WorkOS callback is a top-level
 * navigation from workos.com back to our origin — top-level navigations DO
 * send strict cookies that were set earlier on the same site, but the callback
 * SETS the cookie on a top-level navigation from a third-party origin, which
 * MAY require `sameSite: 'lax'` on the SET step for the cookie to stick in
 * some browsers. If the callback flow regresses, split the cookie policy:
 * keep API reads strict, let the web app issue the cookie with 'lax' on
 * callback and read it back from either policy. Defer the split to Phase 1.1.
 */
export function getSessionCookieClearOptions(): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/';
  maxAge: 0;
} {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  };
}

/**
 * Raw shape sealed by `@workos-inc/authkit-nextjs` into the iron-session cookie.
 * WorkOS uses camelCase for user fields (first_name / last_name are NOT used).
 *
 * `impersonator` is present when a WorkOS team member impersonates a tenant
 * user via the dashboard. We surface this on `AuthenticatedUser` so downstream
 * audit/metrics can tag it; the field is optional.
 */
interface WorkOSImpersonatorPayload {
  email: string;
  reason?: string;
}

interface WorkOSSessionPayload {
  user: {
    object: string;
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    [key: string]: unknown;
  };
  accessToken: string;
  refreshToken: string;
  impersonator?: WorkOSImpersonatorPayload | null;
}

/**
 * Per-issuer JWKS cache. `createRemoteJWKSet` returns a function that does
 * its own in-memory caching, but we cache the function itself so we don't
 * reconstruct it (and blow away its cache) on every request.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000,
    });
    jwksCache.set(issuer, jwks);
  }
  return jwks;
}

/**
 * Verify the WorkOS access token against the WorkOS JWKS. Validates signature,
 * issuer, and audience. Returns the verified payload on success, null on any
 * failure (tampered, expired per jose's default 'exp' check, wrong issuer, etc).
 *
 * Throws `AuthError` with code `WORKOS_CONFIG_MISSING` if the env is not wired.
 * This is a startup-time misconfiguration, not a per-request auth failure —
 * we want to 500 loudly, not silently 401.
 */
async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  const issuer = process.env.WORKOS_ISSUER;
  const audience = process.env.WORKOS_CLIENT_ID;
  if (!issuer || !audience) {
    throw new AuthError(
      'WORKOS_ISSUER and WORKOS_CLIENT_ID must be set to verify WorkOS access tokens',
      'WORKOS_CONFIG_MISSING',
    );
  }
  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), { issuer, audience });
    return payload;
  } catch {
    // Any verify failure (bad sig, bad iss/aud, expired, clock skew) → null.
    // We intentionally DO NOT distinguish — a 401 is a 401.
    return null;
  }
}

/**
 * Test-only: reset the JWKS cache so tests can mock `jose` fresh per case.
 * Not re-exported from the package index.
 */
export function __resetJwksCacheForTests(): void {
  jwksCache.clear();
}

/**
 * Unseal the WorkOS iron-session cookie and return a validated `AuthenticatedUser`.
 *
 * Flow:
 *   1. `unsealData` (iron-session) — tamper check + decrypt with keyring.
 *   2. Shape validation — user.id, user.email, accessToken must be strings.
 *   3. `verifyAccessToken` — full JWT signature + iss + aud verify via WorkOS JWKS.
 *   4. Freshness check — uses the VERIFIED `exp` claim from step 3, not a
 *      manually-decoded payload.
 *
 * @param raw            - Raw sealed cookie value from the HTTP request.
 * @param cookiePassword - Optional override (string for back-compat with tests
 *                         or pre-keyring callers; a full keyring if you want
 *                         to inject rotation state explicitly). Falls back to
 *                         `WORKOS_COOKIE_PASSWORD_KEYRING` / `WORKOS_COOKIE_PASSWORD`.
 * @returns `AuthenticatedUser` on success, `null` on missing/invalid seal,
 *          invalid JWT signature, or expired token.
 * @throws `AuthError` with code `COOKIE_PASSWORD_MISSING` if password is absent/short.
 * @throws `AuthError` with code `WORKOS_CONFIG_MISSING` if issuer/audience absent.
 */
export async function decodeSession(
  raw: string | undefined,
  cookiePassword?: string | CookiePasswordKeyring,
): Promise<AuthenticatedUser | null> {
  if (!raw) return null;

  let password: string | CookiePasswordKeyring;
  if (cookiePassword === undefined) {
    password = getCookiePasswordKeyring();
  } else {
    password = cookiePassword;
  }

  let payload: WorkOSSessionPayload;
  try {
    // iron-session v8 accepts either a single string OR a `{ version: password }`
    // map for rotation. We pass whichever we got; the legacy `getCookiePassword()`
    // path still returns a string for callers that haven't been updated.
    payload = await unsealData<WorkOSSessionPayload>(raw, { password });
  } catch {
    // iron-session throws for malformed/tampered seals — treat as invalid session.
    return null;
  }

  // Validate that unseal produced something that looks like a WorkOS session.
  if (
    !payload ||
    typeof payload !== 'object' ||
    !payload.user ||
    typeof payload.user.id !== 'string' ||
    typeof payload.user.email !== 'string' ||
    typeof payload.accessToken !== 'string'
  ) {
    return null;
  }

  // Verify the access token against WorkOS JWKS. This checks signature, issuer,
  // audience, AND the `exp` claim (jose's default behavior). Unlike the old
  // path we do NOT trust the unseal to imply the token is genuine — iron-session
  // only proves we sealed it, not that WorkOS issued it.
  const verified = await verifyAccessToken(payload.accessToken);
  if (!verified) {
    return null;
  }

  // Use the VERIFIED exp, not a manually-decoded one. jose's jwtVerify already
  // enforces exp by default, but we double-check here for defense in depth and
  // so the isSessionFresh contract stays intact for callers.
  const verifiedExp = typeof verified.exp === 'number' ? verified.exp : null;
  if (!isSessionFresh(verifiedExp !== null ? { exp: verifiedExp } : null)) {
    return null;
  }

  // Normalize WorkOS camelCase → our AuthenticatedUser shape.
  // exactOptionalPropertyTypes: skip the key entirely when value is null.
  const user: AuthenticatedUser = {
    id: payload.user.id,
    email: payload.user.email,
    ...(payload.user.firstName !== null && { first_name: payload.user.firstName }),
    ...(payload.user.lastName !== null && { last_name: payload.user.lastName }),
  };

  // Propagate impersonator if present. Shape validated loosely — an
  // impersonator block must at least have an email string.
  if (
    payload.impersonator &&
    typeof payload.impersonator === 'object' &&
    typeof payload.impersonator.email === 'string'
  ) {
    const reason = payload.impersonator.reason;
    user.impersonator = {
      email: payload.impersonator.email,
      ...(typeof reason === 'string' && { reason }),
    };
  }

  return user;
}
