# @christina-crm/auth

Phase 0.4 — WorkOS auth shared package. Both `apps/web` (Next.js) and `apps/api` (Hono) depend on this.

## What lives here

| File | Purpose | Stability |
| --- | --- | --- |
| `src/types.ts` | `TenantId` (branded), `Role`, `Session`, `AuthenticatedUser`, `TenantContext` | **Stable** — breaking changes require a coordinated bump across web + api |
| `src/errors.ts` | `AuthError`, `TenantMismatchError`, `NotImplementedError` | **Stable** |
| `src/session.ts` | Cookie name, password loader, freshness check, clear-options builder | **Stable** |
| `src/workos-client.ts` | Singleton `WorkOS` SDK client (lazy-init) | **Stable** |
| `src/tenant.ts` | `resolveTenantFromUser()` — maps WorkOS user → tenant + role | **STUB** — real DB lookup lands in Phase 0.3 |
| `src/mfa.ts` | `enforceMfaForTenant()` | **STUB** — post-MVP, throws `NotImplementedError` |

## Boundary rules

1. **Every `tenant_id` on the wire is a `TenantId`.** `asTenantId(raw)` must only be called after the value came from (a) a verified session cookie, (b) a DB row, or (c) WorkOS user metadata. Never mint one from a request body.
2. **`resolveTenantFromUser()` is the single chokepoint.** If you need tenant context anywhere, go through this function, not ad-hoc lookups. Phase 0.3 DB-backs it; until then it reads `DEV_AUTH_TENANT_ID` + `DEV_AUTH_ROLE` from env for local dev.
3. **Roles are pinned.** `Role = 'admin' | 'clinician' | 'bd' | 'read_only'`. Adding a role means touching every permission check — do it on purpose, in a review.

## What's stubbed vs wired

- WorkOS client (`getWorkOSClient`) — **wired**, lazy-init, throws on missing env.
- Cookie helpers (`SESSION_COOKIE_NAME`, `getCookiePassword`, etc.) — **wired**. The actual encrypt/decrypt lives in `@workos-inc/authkit-nextjs` for the web side; the API side reads the same cookie by name.
- `resolveTenantFromUser()` — **stubbed** against env. Phase 0.3 replaces the body with a Drizzle query.
- `enforceMfaForTenant()` — **stubbed**. Post-MVP.
- JIT user provisioning — **stubbed** inside `tenant.ts` (throws `TenantMismatchError` for now). Post-MVP.

## Env the package needs

```
WORKOS_API_KEY                      # from WorkOS dashboard → sandbox org
WORKOS_CLIENT_ID                    # from the same page; also the JWT `aud` claim
WORKOS_ISSUER                       # JWT `iss` claim + JWKS base URL (e.g. https://api.workos.com)
WORKOS_COOKIE_PASSWORD              # openssl rand -hex 32 — min 32 chars (single-key form)
WORKOS_COOKIE_PASSWORD_KEYRING      # optional; JSON { "1":"...", "2":"..." } for rotation
WORKOS_REDIRECT_URI                 # http://localhost:3000/auth/callback in dev
NEXT_PUBLIC_WORKOS_ENV              # sandbox | production (web-only, non-secret)
WORKOS_WEBHOOK_SECRET               # used by apps/api/src/routes/webhooks/workos-scim.ts
DEV_AUTH_TENANT_ID                  # LOCAL DEV ONLY — must NEVER exist in staging/prod
DEV_AUTH_ROLE                       # LOCAL DEV ONLY — one of admin|clinician|bd|read_only
```

### Cookie password rotation (`WORKOS_COOKIE_PASSWORD_KEYRING`)

iron-session v8 accepts a `{ <version>: <password> }` map natively — it seals
with the highest-numbered version and tries every entry on unseal. This lets
us rotate without invalidating every active session.

Procedure:

1. Generate a new password: `openssl rand -hex 32`.
2. Set `WORKOS_COOKIE_PASSWORD_KEYRING` in Doppler to the JSON with both old
   and new versions, e.g. `{"1": "<old>", "2": "<new>"}`.
3. Deploy. New cookies are now sealed with version 2; version 1 still unseals.
4. Wait ≥ 7 days (longer than max cookie lifetime).
5. Remove version 1 from the keyring. Deploy again.

Keyring version keys MUST be numeric strings (`'1'`, `'2'`, ...). Non-numeric keys are selected via unstable `localeCompare` fallback.

If `WORKOS_COOKIE_PASSWORD_KEYRING` is set, `WORKOS_COOKIE_PASSWORD` is
ignored. In dev the single-key form is fine.

### JWT verification (`WORKOS_ISSUER`)

`decodeSession` verifies the WorkOS access-token signature against the WorkOS
JWKS at `${WORKOS_ISSUER}/.well-known/jwks.json` (cached in-process for 10
minutes, 30-second refresh cooldown). It also enforces the `iss` and `aud`
claims: `aud` must equal `WORKOS_CLIENT_ID`. A valid iron-session seal is
NOT sufficient proof that a JWT is genuine — the old "unseal implies trust"
path was the CRIT-2 finding.

## Import style

```ts
import {
  asTenantId,
  getWorkOSClient,
  resolveTenantFromUser,
  SESSION_COOKIE_NAME,
  TenantMismatchError,
  type Session,
  type TenantId,
} from '@christina-crm/auth';
```

## Session decode flow (API side)

The Hono API reads the same `wos-session` cookie that `@workos-inc/authkit-nextjs` writes on the web side. `decodeSession(raw, cookiePassword?)` in `session.ts` is the single decode path:

1. `iron-session` `unsealData` with the password keyring (single-key or rotation map).
2. Shape validation — `user.id`, `user.email`, `accessToken` must all be strings.
3. `jwtVerify` (from `jose`) against the WorkOS JWKS at `${WORKOS_ISSUER}/.well-known/jwks.json`, enforcing `iss` and `aud` (= `WORKOS_CLIENT_ID`). This is full signature verification, NOT a manual base64 decode.
4. Freshness — uses the verified `exp` claim from step 3.

On success it normalises WorkOS's camelCase `firstName`/`lastName` fields into the `AuthenticatedUser` shape (`first_name`/`last_name`) and, if the session cookie carries an `impersonator` block, surfaces it as `user.impersonator = { email, reason? }` so downstream audit/metrics can tag it.

Any invalid seal, bad JWT signature, wrong issuer/audience, or expired token returns `null`. A missing or too-short cookie password throws `AuthError` with code `COOKIE_PASSWORD_MISSING`; missing `WORKOS_ISSUER` / `WORKOS_CLIENT_ID` throws `WORKOS_CONFIG_MISSING` — both are startup misconfigurations we want to page on, not silently 401.

## Test seams

`__resetWorkOSClientForTests()` in `workos-client.ts` is intentionally NOT exported from `index.ts`. Tests should import it directly from the module path.
