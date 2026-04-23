-- =========================================================================
-- 0004_crm_app_role.sql
--
-- Creates the `crm_app` role and grants the minimum privileges needed for
-- the application runtime. Split from 0001 so replay remains clean if a
-- reviewer wants to re-run just the policies.
--
-- The application's login role should INHERIT crm_app, e.g.:
--     CREATE ROLE crm_api LOGIN PASSWORD '...' IN ROLE crm_app;
--
-- `crm_app` is NOLOGIN — nobody connects as the role directly. It exists
-- only as a permission envelope. It does NOT have BYPASSRLS, so RLS
-- policies apply to every query issued through an inheriting login role.
--
-- Grant doctrine:
--   - Table DML is granted EXPLICITLY per table (enumerated below) so a
--     later migration that accidentally creates a PHI-adjacent table
--     inside `crm.*` does NOT automatically receive UPDATE/DELETE.
--   - New PHI-adjacent tables MUST add their own GRANT lines in the
--     migration that creates them. Do NOT rely on default privileges to
--     cover them — see the `ALTER DEFAULT PRIVILEGES` block below, which
--     is narrowed to SELECT + sequence usage only.
-- =========================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
        CREATE ROLE crm_app NOLOGIN;
    END IF;
END
$$;

-- Schema-level
GRANT USAGE ON SCHEMA crm TO crm_app;

-- Explicit per-table DML grants. Enumerated from 0000_initial_crm_schema.sql.
-- Add a new line here (in the same migration that creates the table) when a
-- new table lands. Do NOT rely on ALTER DEFAULT PRIVILEGES for DML.
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.tenants             TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.users               TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.organizations       TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.contacts            TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.referrals           TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.referral_notes      TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.referral_documents  TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.bd_visits           TO crm_app;
GRANT SELECT, INSERT                 ON crm.audit_log           TO crm_app;

GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA crm TO crm_app;

-- Default privileges are narrowed to SELECT (tables) + USAGE (sequences) only.
-- Any new table that needs INSERT/UPDATE/DELETE MUST be added to the explicit
-- list above in its creating migration. This prevents a future PHI-adjacent
-- table from inheriting write grants by accident.
ALTER DEFAULT PRIVILEGES IN SCHEMA crm
    GRANT SELECT                         ON TABLES    TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm
    GRANT SELECT, USAGE                  ON SEQUENCES TO crm_app;

-- Audit log hardening: append-only. Revoke UPDATE + DELETE at the grant level
-- as well as at the policy level (see 0001_rls_policies.sql). Belt and
-- suspenders — the policy USING (false) already blocks it, and this makes
-- the grant surface match.
REVOKE UPDATE, DELETE ON crm.audit_log FROM crm_app;
