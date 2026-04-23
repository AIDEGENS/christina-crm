-- =========================================================================
-- 0003_updated_at_triggers.sql
--
-- Auto-touch `updated_at` on UPDATE for every mutable table.
-- Mirrors .omc/verifier-spec/schema.sql `touch_updated_at()` pattern.
--
-- audit_log is EXCLUDED — it is append-only and has no updated_at column.
-- =========================================================================

CREATE OR REPLACE FUNCTION crm.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- tenants
DROP TRIGGER IF EXISTS tenants_touch_updated_at ON crm.tenants;
CREATE TRIGGER tenants_touch_updated_at
    BEFORE UPDATE ON crm.tenants
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- users
DROP TRIGGER IF EXISTS users_touch_updated_at ON crm.users;
CREATE TRIGGER users_touch_updated_at
    BEFORE UPDATE ON crm.users
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- organizations
DROP TRIGGER IF EXISTS organizations_touch_updated_at ON crm.organizations;
CREATE TRIGGER organizations_touch_updated_at
    BEFORE UPDATE ON crm.organizations
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- contacts
DROP TRIGGER IF EXISTS contacts_touch_updated_at ON crm.contacts;
CREATE TRIGGER contacts_touch_updated_at
    BEFORE UPDATE ON crm.contacts
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- referrals
DROP TRIGGER IF EXISTS referrals_touch_updated_at ON crm.referrals;
CREATE TRIGGER referrals_touch_updated_at
    BEFORE UPDATE ON crm.referrals
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- referral_notes
DROP TRIGGER IF EXISTS referral_notes_touch_updated_at ON crm.referral_notes;
CREATE TRIGGER referral_notes_touch_updated_at
    BEFORE UPDATE ON crm.referral_notes
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- referral_documents
DROP TRIGGER IF EXISTS referral_documents_touch_updated_at ON crm.referral_documents;
CREATE TRIGGER referral_documents_touch_updated_at
    BEFORE UPDATE ON crm.referral_documents
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();

-- bd_visits
DROP TRIGGER IF EXISTS bd_visits_touch_updated_at ON crm.bd_visits;
CREATE TRIGGER bd_visits_touch_updated_at
    BEFORE UPDATE ON crm.bd_visits
    FOR EACH ROW EXECUTE FUNCTION crm.touch_updated_at();
