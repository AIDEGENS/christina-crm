-- =========================================================================
-- 0001_rls_policies.sql
--
-- Row-Level Security for all 9 `crm.*` tables.
--
-- Pattern (mirrors .omc/verifier-spec/schema.sql):
--   1. ENABLE ROW LEVEL SECURITY — turns RLS on.
--   2. FORCE ROW LEVEL SECURITY — applies RLS even to the table owner, so
--      a compromised app role cannot bypass it by coincidence of ownership.
--      Only superusers and BYPASSRLS roles skip FORCE RLS.
--   3. Fail-closed policies: `current_setting('app.current_tenant', true)`
--      returns NULL (not an error) when unset, and the policy requires
--      BOTH that the GUC is set AND that tenant_id matches. If the GUC is
--      NULL, zero rows match on SELECT and writes are rejected by WITH CHECK.
--
-- The application middleware MUST call:
--     SELECT set_config('app.current_tenant', $1, true);
-- inside each transaction (see packages/db/src/tenant-context.ts).
--
-- Superuser / BYPASSRLS roles (migrations, seed) bypass all policies.
-- The app connects through `crm_app` (NOLOGIN) which does NOT have BYPASSRLS.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Enable + force RLS on every table
-- -------------------------------------------------------------------------
ALTER TABLE crm.tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.tenants              FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.users                FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.organizations        FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.contacts             FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.referrals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.referrals            FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.referral_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.referral_notes       FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.referral_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.referral_documents   FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.bd_visits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.bd_visits            FORCE  ROW LEVEL SECURITY;
ALTER TABLE crm.audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.audit_log            FORCE  ROW LEVEL SECURITY;


-- -------------------------------------------------------------------------
-- 2. tenants — self-scope: each connection sees its own tenant row only
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS tenants_self_scope ON crm.tenants;
CREATE POLICY tenants_self_scope ON crm.tenants
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND id = current_setting('app.current_tenant', true)::uuid
    );


-- -------------------------------------------------------------------------
-- 3. Generic tenant_isolation policies for all child tables
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS users_tenant_isolation ON crm.users;
CREATE POLICY users_tenant_isolation ON crm.users
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS organizations_tenant_isolation ON crm.organizations;
CREATE POLICY organizations_tenant_isolation ON crm.organizations
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS contacts_tenant_isolation ON crm.contacts;
CREATE POLICY contacts_tenant_isolation ON crm.contacts
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS referrals_tenant_isolation ON crm.referrals;
CREATE POLICY referrals_tenant_isolation ON crm.referrals
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS referral_notes_tenant_isolation ON crm.referral_notes;
CREATE POLICY referral_notes_tenant_isolation ON crm.referral_notes
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS referral_documents_tenant_isolation ON crm.referral_documents;
CREATE POLICY referral_documents_tenant_isolation ON crm.referral_documents
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS bd_visits_tenant_isolation ON crm.bd_visits;
CREATE POLICY bd_visits_tenant_isolation ON crm.bd_visits
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );


-- -------------------------------------------------------------------------
-- 4. audit_log — append-only
--
-- SELECT + INSERT are tenant-scoped. UPDATE + DELETE are hard-blocked by
-- explicit `USING (false)` policies. Because RLS is FORCE-enabled, even the
-- table owner cannot mutate historical rows through the app role.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_tenant_select ON crm.audit_log;
CREATE POLICY audit_log_tenant_select ON crm.audit_log
    FOR SELECT
    USING (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS audit_log_tenant_insert ON crm.audit_log;
CREATE POLICY audit_log_tenant_insert ON crm.audit_log
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_tenant', true) IS NOT NULL
        AND tenant_id = current_setting('app.current_tenant', true)::uuid
    );

DROP POLICY IF EXISTS audit_log_no_update ON crm.audit_log;
CREATE POLICY audit_log_no_update ON crm.audit_log
    FOR UPDATE
    USING (false)
    WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_delete ON crm.audit_log;
CREATE POLICY audit_log_no_delete ON crm.audit_log
    FOR DELETE
    USING (false);
