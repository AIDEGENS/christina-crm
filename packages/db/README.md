# @christina-crm/db

Drizzle ORM schema, migrations, and RLS policies for the CRM Postgres database. All tables live in the `crm.*` schema inside the shared RDS cluster (separate from `claims.*` and `verification.*`).

## The `app.current_tenant` pattern

The CRM is multi-tenant with per-row isolation enforced by Postgres Row-Level Security. Every tenant-scoped table has `FORCE ROW LEVEL SECURITY` and a fail-closed policy of the form `tenant_id = current_setting('app.current_tenant', true)::uuid AND current_setting(...) IS NOT NULL`. The application is expected to call `SELECT set_config('app.current_tenant', $1, true)` at the start of every transaction — the `true` flag scopes the GUC to the transaction, so pooled connections cannot leak state across requests. The helper `withTenant(db, tenantId, fn)` in `src/tenant-context.ts` wraps this pattern. If the GUC is unset, policies return zero rows on SELECT and reject every INSERT/UPDATE/DELETE; that is why we use FORCE RLS — it applies the same rule to the table owner, so a misconfigured login role cannot coincidentally bypass tenant isolation just because it happens to own the table. Migrations and the seed script should connect as an admin role with BYPASSRLS; the runtime application connects as a role that INHERITS the NOLOGIN `crm_app` envelope defined in `migrations/0004_crm_app_role.sql`.

### Canonical GUC name: `app.current_tenant`

The CRM side uses `app.current_tenant`. The Verifier spec (`.omc/verifier-spec/schema.sql`) uses `app.tenant_id` because it models a distinct logical schema with its own RLS surface. **The two are intentionally different and must not be copied across.** If you are writing a new migration, policy, or middleware that touches `crm.*`, the name is always `app.current_tenant`; `app.tenant_id` is reserved for the Verifier schema.

## Applying migrations

Migrations are ordered and must be applied in sequence:

1. `0000_initial_crm_schema.sql` — creates the 9 tables, FKs, CHECK constraints. Depends on `pgcrypto` and `uuid-ossp` extensions being installed first.
2. `0001_rls_policies.sql` — enables + forces RLS and defines the tenant isolation policies. `audit_log` additionally gets `USING (false)` on UPDATE + DELETE.
3. `0002_indexes.sql` — installs `pg_trgm` and creates all performance + tenant-scoped indexes.
4. `0003_updated_at_triggers.sql` — registers the `crm.touch_updated_at()` trigger on every mutable table (audit_log excluded).
5. `0004_crm_app_role.sql` — creates the NOLOGIN `crm_app` role and assigns grants.

Apply order (example):

```bash
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Then seed: `pnpm tsx packages/db/src/seed.ts` (requires `DATABASE_URL` set and admin/BYPASSRLS credentials).

### Regenerating 0000 after `pnpm install`

`0000_initial_crm_schema.sql` was hand-written so schema work could land before the root workspace has a `pnpm-lock.yaml`. Once dependencies are installed, run `pnpm drizzle-kit generate` from `packages/db/` to let drizzle-kit own the journal. The structural diff should be a no-op; **CHECK/constraint names MUST match or be manually reconciled** — a rename between the Drizzle schema and the hand-written SQL silently drops and recreates the constraint on the next generated migration. After the first `pnpm install`, run `pnpm drizzle-kit generate` and diff against the hand-written 0000; if drizzle-kit emits a different name, fix the source of truth before letting it replace the bootstrap file.

## Why FORCE RLS

Plain `ENABLE ROW LEVEL SECURITY` skips RLS for the role that owns the table — typically the migration role, but in smaller deployments the same role the app connects as. `FORCE ROW LEVEL SECURITY` closes that hole: RLS is applied to every role except superusers and roles with the explicit `BYPASSRLS` attribute. Migration tooling and the seed script intentionally run as an admin role with BYPASSRLS so they can populate tenants; the application runtime connects through `crm_app` (which does NOT have BYPASSRLS), so every SELECT/INSERT/UPDATE/DELETE goes through the policy check. This is the same pattern the Verifier's `verification.*` schema uses in `.omc/verifier-spec/schema.sql` — keeping both sides consistent means an auditor only has to learn the pattern once.

## TLS / SSL

`createDb` in `src/client.ts` resolves the SSL option as follows:

- **Production** (`NODE_ENV === 'production'`): defaults to `{ rejectUnauthorized: true }` — the connection verifies the server certificate against the system trust store. Prod deployments **MUST** pass a CA bundle via `config.ssl = { rejectUnauthorized: true, ca: <pem> }` once the Phase 0.2 RDS bootstrap step ships a canonical CA bundle path. Encryption without verification does not defend against MITM.
- **Development**: defaults to `'require'` — encryption only, no verification. This keeps local docker-compose setups using self-signed certs working without ceremony.
- **Override**: callers always win. Pass `config.ssl` explicitly to force a specific mode.

## Migration review rules

- **FORCE RLS does not protect against `SECURITY DEFINER` functions.** A function declared `SECURITY DEFINER` runs as its owner, which can hold `BYPASSRLS` and therefore sees every tenant's rows regardless of policy.
- **Any future `SECURITY DEFINER` function MUST be tagged** `-- RLS-REVIEWED: <reviewer>` in the migration that creates it, documenting who signed off on the cross-tenant exposure.
- **CI should fail if an untagged `SECURITY DEFINER` appears.** Not implemented yet — TODO: add a grep-based lint over `packages/db/migrations/**/*.sql` that rejects `SECURITY DEFINER` without the adjacent `-- RLS-REVIEWED:` marker.
