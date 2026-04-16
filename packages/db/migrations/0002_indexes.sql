-- Step 0.3-local: Performance indexes + trigram fuzzy-search indexes.
-- Runs after 0001. Not applied yet.
--
-- Priority comes from CRM-09-PIPELINE and CRM-11-BD: the pipeline view
-- reads referrals by (tenant_id, status) most often; org scorecards read
-- referrals by (source_org_id, created_at) within a 30-day window; the BD
-- mobile view reads bd_visits by (user_id, visit_date). Those three hot
-- paths get dedicated indexes. pg_trgm covers Phase 4 fuzzy lookup of
-- organizations and contacts by name.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Referral pipeline (hottest path).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_referrals_tenant_status"
  ON "crm"."referrals" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_referrals_tenant_created"
  ON "crm"."referrals" ("tenant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_referrals_source_org"
  ON "crm"."referrals" ("source_org_id");

CREATE INDEX IF NOT EXISTS "idx_referrals_assigned"
  ON "crm"."referrals" ("assigned_to")
  WHERE "assigned_to" IS NOT NULL;

-- Org scorecards (30-day rolling window).
CREATE INDEX IF NOT EXISTS "idx_referrals_org_recent"
  ON "crm"."referrals" ("source_org_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- BD rep mobile view.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_bd_visits_user_date"
  ON "crm"."bd_visits" ("user_id", "visit_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_bd_visits_org_date"
  ON "crm"."bd_visits" ("org_id", "visit_date" DESC);

-- ---------------------------------------------------------------------------
-- Audit log time-series scans (compliance + incident review).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_audit_tenant_time"
  ON "crm"."audit_log" ("tenant_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- Referral notes + documents lookups by referral.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_referral_notes_referral"
  ON "crm"."referral_notes" ("referral_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_referral_documents_referral"
  ON "crm"."referral_documents" ("referral_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- Contact joins per organization.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_contacts_org"
  ON "crm"."contacts" ("org_id");

-- ---------------------------------------------------------------------------
-- Fuzzy search (Phase 4 — organization + contact name typeahead).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_orgs_name_trgm"
  ON "crm"."organizations" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_contacts_fullname_trgm"
  ON "crm"."contacts" USING GIN ((coalesce("first_name", '') || ' ' || coalesce("last_name", '')) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- WorkOS login lookup.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_users_workos"
  ON "crm"."users" ("workos_user_id");
