-- Step 0.3-local: Row-Level Security policies + app-role grants.
-- Not applied to any database yet. Will run post-BAA against RDS.
--
-- Pattern: the app connects as the `crm_app` role (not superuser). Every
-- request sets `SET LOCAL app.current_tenant = '<uuid>'` in a transaction.
-- All tenant-scoped tables filter by that setting via RLS.
-- Audit log is append-only: UPDATE and DELETE are blocked by policy.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every tenant-scoped table.
-- ---------------------------------------------------------------------------

ALTER TABLE "crm"."tenants"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."users"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."organizations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."contacts"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."referrals"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."referral_notes"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."referral_documents"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."bd_visits"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm"."audit_log"           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Tenants: users can only see their own tenant row (by id, not tenant_id).
-- ---------------------------------------------------------------------------

CREATE POLICY "tenants_self_select" ON "crm"."tenants"
  FOR SELECT
  USING (id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- 3. Generic tenant_isolation policy for every child table.
--    Applies to ALL commands (SELECT, INSERT, UPDATE, DELETE).
-- ---------------------------------------------------------------------------

CREATE POLICY "tenant_isolation" ON "crm"."users"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."organizations"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."contacts"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."referrals"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."referral_notes"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."referral_documents"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "tenant_isolation" ON "crm"."bd_visits"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- 4. Audit log is append-only:
--    SELECT/INSERT restricted to own tenant; UPDATE + DELETE always blocked.
-- ---------------------------------------------------------------------------

CREATE POLICY "audit_log_tenant_select" ON "crm"."audit_log"
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "audit_log_tenant_insert" ON "crm"."audit_log"
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY "audit_log_no_update" ON "crm"."audit_log"
  FOR UPDATE
  USING (false);

CREATE POLICY "audit_log_no_delete" ON "crm"."audit_log"
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- 5. Application role + grants.
--    The API connects as `crm_app`, which inherits no superuser privileges
--    and therefore cannot bypass RLS. RDS master user (crm_admin) remains
--    BYPASSRLS for migrations; never use it from the app runtime.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE ROLE "crm_app" NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA "crm" TO "crm_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "crm" TO "crm_app";
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA "crm" TO "crm_app";

-- Future tables/sequences should also be accessible to crm_app.
ALTER DEFAULT PRIVILEGES IN SCHEMA "crm"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "crm_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "crm"
  GRANT SELECT, USAGE ON SEQUENCES TO "crm_app";
