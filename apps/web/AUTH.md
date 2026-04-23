# Auth flow — apps/web (Phase 0.4)

This doc is the contract for how the web app authenticates users. If the code disagrees with what's below, the code is wrong — fix it, don't rewrite the doc first.

## Stack

- **Provider**: WorkOS AuthKit (hosted sign-in + SSO + magic link)
- **SDK**: `@workos-inc/authkit-nextjs@^2` (web-side middleware + helpers)
- **Session transport**: httpOnly + secure + sameSite=lax cookie named `wos-session`, signed & encrypted with `WORKOS_COOKIE_PASSWORD`
- **Tenant resolution**: every authenticated user is mapped to ONE tenant via `resolveTenantFromUser()` in `@christina-crm/auth`

## Request lifecycle

```
  Browser              Next.js (apps/web)                 WorkOS
  -------              ------------------                 ------
    |                         |                              |
    | GET /dashboard          |                              |
    |------------------------>|                              |
    |                         | middleware.ts                |
    |                         | authkitMiddleware:           |
    |                         |   no session cookie?         |
    |                         |   -> redirect /sign-in       |
    |<------------------------|                              |
    |                                                        |
    | GET /sign-in            |                              |
    |------------------------>|                              |
    |                         | sign-in/page.tsx             |
    |                         | getSignInUrl() -> WorkOS URL |
    |                         | redirect(url)                |
    |<------------------------|                              |
    |                                                        |
    | GET https://api.workos.com/user_management/authorize   |
    |------------------------------------------------------->|
    |                                                        |
    |                   user signs in on WorkOS hosted page  |
    |                                                        |
    | 302 GET /auth/callback?code=...                        |
    |<-------------------------------------------------------|
    |                         |                              |
    |------------------------>|                              |
    |                         | auth/callback/route.ts       |
    |                         | handleAuth():                |
    |                         |   exchange code -> session   |
    |                         |   set wos-session cookie     |
    |                         |   redirect /dashboard        |
    |<------------------------|                              |
    |                         |                              |
    | GET /dashboard (with cookie)                           |
    |------------------------>|                              |
    |                         | middleware lets it through   |
    |                         | dashboard/page.tsx:          |
    |                         |   withAuth() -> user         |
    |                         |   resolveTenantFromUser()    |
    |                         |   render greeting + tenant   |
    |<------------------------|                              |
```

## Public (unauthenticated) routes

Defined in `middleware.ts → middlewareAuth.unauthenticatedPaths`:

- `/` — marketing shell
- `/health` — liveness probe
- `/sign-in` — redirector to WorkOS hosted page
- `/sign-up` — reserved (AuthKit hosted up flow)
- `/auth/*` — callback + any future AuthKit sub-routes

Everything else requires a session. Add a route to the allow-list only with a review — every addition is a potential auth-bypass.

## Sign-out

`POST /sign-out` clears the cookie via AuthKit's `signOut()` and redirects home. GET is intentionally not supported — prevents drive-by logout via image tags or link prefetching.

## Local dev setup

1. Create a sandbox org at https://dashboard.workos.com (pick "Development" environment).
2. In **Configuration → Redirects**, add `http://localhost:3000/auth/callback`.
3. Copy **API Key** and **Client ID** into `apps/web/.env.local`.
4. Generate a cookie password: `openssl rand -hex 32`. Paste into `WORKOS_COOKIE_PASSWORD`.
5. Until Phase 0.3 lands, set `DEV_AUTH_TENANT_ID` and `DEV_AUTH_ROLE` in `.env.local` so `resolveTenantFromUser()` returns something (the DB-backed version isn't live yet).
6. `pnpm install` at the repo root, then `pnpm dev` from `apps/web/`.

Once Phase 0.7 ships Doppler, these values move out of `.env.local` entirely.

## Server components

Use `getCurrentUser()` from `apps/web/lib/auth.ts` — it bundles `withAuth()` + `resolveTenantFromUser()` into one call and returns `{ user, tenant_id, role }`.

```ts
import { getCurrentUser } from '@/lib/auth';

export default async function SomeProtectedPage() {
  const { user, tenant_id, role } = await getCurrentUser();
  // ...
}
```

Never call `resolveTenantFromUser()` on a raw `user.id` — it expects the full `AuthenticatedUser` shape and the tenant cache keys on the whole object.

## Known limitations (Phase 0.4)

- **Tenant mapping is env-based.** `DEV_AUTH_TENANT_ID` / `DEV_AUTH_ROLE` work for one user, one tenant. Multi-user testing needs Phase 0.3's `tenant_members` table.
- **MFA is not enforced.** `enforceMfaForTenant()` in `@christina-crm/auth` throws `NotImplementedError`. Post-MVP.
- **JIT provisioning is a stub.** A valid WorkOS user with no tenant row gets a `TenantMismatchError`. Post-MVP.
- **SCIM directory sync is a stub.** The webhook endpoint at `apps/api/src/routes/webhooks/workos-scim.ts` accepts events but doesn't apply them.
- **Tenant switcher UI does not exist.** Phase 3.3 adds it. Until then, a user belongs to exactly one tenant and that's what they see.

## HIPAA posture

- Cookie is `httpOnly` + `secure` (production) + `sameSite=lax` — prevents XSS theft and most CSRF.
- No PHI in session cookie. Only `{ user.id, user.email, tenant_id, role, exp }`.
- Sign-out fully clears cookie; session revocation at WorkOS side happens via the same call.
- All auth-bound routes run server-side; no tokens are exposed to client JS.

See `REF/CRM-08-SECURITY-HIPAA.md` for the full posture.
