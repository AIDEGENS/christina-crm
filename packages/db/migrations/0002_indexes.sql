-- =========================================================================
-- 0002_indexes.sql
--
-- Indexes sized for the Phase 1 query mix:
--   - Kanban pipeline: tenant_id + status
--   - Recency feeds: tenant_id + created_at DESC
--   - Org scorecards: source_org_id + created_at DESC
--   - BD route planning: user_id + visit_date DESC
--   - Audit time-series: tenant_id + created_at DESC
--   - Fuzzy search (Phase 4): pg_trgm on org/contact names
-- =========================================================================

-- -------------------------------------------------------------------------
-- referrals — primary workload
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_referrals_tenant_status
    ON crm.referrals (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_referrals_tenant_created
    ON crm.referrals (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_source_org
    ON crm.referrals (source_org_id)
    WHERE source_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_assigned
    ON crm.referrals (assigned_to)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_org_recent
    ON crm.referrals (source_org_id, created_at DESC)
    WHERE source_org_id IS NOT NULL;


-- -------------------------------------------------------------------------
-- bd_visits
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bd_visits_user_date
    ON crm.bd_visits (user_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_bd_visits_org_date
    ON crm.bd_visits (org_id, visit_date DESC);


-- -------------------------------------------------------------------------
-- audit_log
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time
    ON crm.audit_log (tenant_id, created_at DESC);


-- -------------------------------------------------------------------------
-- Tenant-scoped lookups on child tables (help RLS USING clauses stay fast)
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_organizations_tenant
    ON crm.organizations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_org
    ON crm.contacts (tenant_id, org_id);

CREATE INDEX IF NOT EXISTS idx_users_tenant
    ON crm.users (tenant_id);

CREATE INDEX IF NOT EXISTS idx_referral_notes_referral
    ON crm.referral_notes (referral_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_documents_referral
    ON crm.referral_documents (referral_id);


-- -------------------------------------------------------------------------
-- Fuzzy search (Phase 4) — requires pg_trgm extension
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_organizations_name_trgm
    ON crm.organizations
    USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
    ON crm.contacts
    USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
