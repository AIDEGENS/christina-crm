-- =========================================================================
-- 0000_initial_crm_schema.sql
--
-- Initial `crm` schema: 9 tables, FKs, CHECK constraints.
--
-- Hand-written to match Drizzle's expected output format. After `pnpm install`
-- runs, this file can be regenerated via `pnpm drizzle-kit generate` — the
-- structural output should match. If drizzle-kit diverges, drizzle wins (it
-- owns the journal); this file serves as the bootstrap migration until then.
--
-- Dependencies (must exist before this migration runs):
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- RLS is NOT enabled here — see 0001_rls_policies.sql.
-- Indexes are NOT created here — see 0002_indexes.sql.
-- updated_at triggers are NOT created here — see 0003_updated_at_triggers.sql.
-- crm_app role + grants — see 0004_crm_app_role.sql.
-- =========================================================================

CREATE SCHEMA IF NOT EXISTS crm;

-- -------------------------------------------------------------------------
-- tenants
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.tenants (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    text        NOT NULL,
    npi                     text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer.
    ein                     text,
    medicare_ptan           text,
    mac_jurisdiction        text,
    medi_cal_provider_id    text,
    service_area            text[],
    stripe_customer_id      text,
    metadata                jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    -- NOTE: CHECK constraint names MUST stay byte-identical to the Drizzle
    -- schema (`packages/db/src/schema/tenants.ts::tenants_mac_jurisdiction_chk`).
    -- After `pnpm install` lands, run `pnpm drizzle-kit generate` from
    -- `packages/db/` and diff against this file — any rename here silently
    -- drops and recreates the constraint on the next generated migration.
    CONSTRAINT tenants_mac_jurisdiction_chk CHECK (
        mac_jurisdiction IS NULL
        OR mac_jurisdiction IN ('noridian_je', 'noridian_jf', 'ngs')
    )
);

-- -------------------------------------------------------------------------
-- users
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    workos_user_id  text        NOT NULL UNIQUE,
    email           text        NOT NULL,
    display_name    text,
    role            text        NOT NULL,
    active          boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_role_chk CHECK (
        role IN ('admin', 'intake', 'bd_rep', 'viewer')
    )
);

-- -------------------------------------------------------------------------
-- organizations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.organizations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    name            text        NOT NULL,
    type            text        NOT NULL,
    npi             text,
    address         jsonb,
    phone           text,
    fax             text,
    owner_user_id   uuid        REFERENCES crm.users (id) ON DELETE SET NULL,
    last_contact_at timestamptz,
    metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizations_type_chk CHECK (
        type IN ('acute_care', 'snf', 'physician', 'hospice_facility', 'other')
    )
);

-- -------------------------------------------------------------------------
-- contacts
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.contacts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid        NOT NULL
                                    REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    org_id              uuid        NOT NULL
                                    REFERENCES crm.organizations (id) ON DELETE RESTRICT,
    first_name          text        NOT NULL,
    last_name           text        NOT NULL,
    title               text,
    role                text,
    npi                 text,
    phone               text,
    email               text,
    preferred_contact   text,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contacts_preferred_contact_chk CHECK (
        preferred_contact IS NULL
        OR preferred_contact IN ('phone', 'email', 'fax', 'in_person')
    )
);

-- -------------------------------------------------------------------------
-- referrals
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.referrals (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid        NOT NULL
                                        REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    ref_number              text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'new',
    source_org_id           uuid        REFERENCES crm.organizations (id) ON DELETE SET NULL,
    source_contact_id       uuid        REFERENCES crm.contacts (id) ON DELETE SET NULL,
    intake_channel          text,
    patient_initials        text,
    patient_age             integer,
    patient_sex             text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patient_dob             text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patient_mrn             text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patient_address         text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patient_member_id       text,
    -- TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patient_ssn_last4       text,
    primary_dx_code         text,
    primary_dx_desc         text,
    secondary_dx            jsonb       NOT NULL DEFAULT '[]'::jsonb,
    payer_type              text,
    payer_name              text,
    -- Service county. Required by Verifier VR-009 at routing time.
    -- Nullable here so legacy rows migrate cleanly; backfill before VR-009 flips active.
    county                  text,
    orders                  text[],
    discharge_date          date,
    eligibility_status      text        NOT NULL DEFAULT 'not_checked',
    eligibility_checked_at  timestamptz,
    eligibility_stedi_txn   text,
    denial_risk_score       integer,
    soc_date                date,
    soc_nurse_id            uuid        REFERENCES crm.users (id) ON DELETE SET NULL,
    admitted_at             timestamptz,
    lost_reason             text,
    assigned_to             uuid        REFERENCES crm.users (id) ON DELETE SET NULL,
    ai_confidence           double precision,
    raw_document_s3_key     text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT referrals_status_chk CHECK (
        status IN ('new', 'eligibility', 'soc_scheduled', 'admitted', 'lost', 'denied')
    ),
    CONSTRAINT referrals_intake_channel_chk CHECK (
        intake_channel IS NULL
        OR intake_channel IN ('fax', 'email', 'e_referral', 'phone', 'walk_in')
    ),
    CONSTRAINT referrals_patient_sex_chk CHECK (
        patient_sex IS NULL OR patient_sex IN ('m', 'f', 'other')
    ),
    CONSTRAINT referrals_payer_type_chk CHECK (
        payer_type IS NULL
        OR payer_type IN ('medicare_a', 'medicare_b', 'medi_cal', 'ma_plan', 'private', 'other')
    ),
    CONSTRAINT referrals_eligibility_status_chk CHECK (
        eligibility_status IN ('pending', 'verified', 'failed', 'not_checked')
    ),
    CONSTRAINT referrals_county_chk CHECK (
        county IS NULL
        OR county IN ('los_angeles', 'san_bernardino', 'riverside', 'orange', 'san_diego')
    )
);

COMMENT ON COLUMN crm.referrals.county IS
    'Service county (VR-009). Required at routing time for Medi-Cal MCO and Medicare Advantage; intake must backfill before VR-009 is flipped active in verification.rules.';

-- -------------------------------------------------------------------------
-- referral_notes
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.referral_notes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    referral_id     uuid        NOT NULL
                                REFERENCES crm.referrals (id) ON DELETE CASCADE,
    author_user_id  uuid        REFERENCES crm.users (id) ON DELETE SET NULL,
    note_type       text        NOT NULL DEFAULT 'manual',
    body            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT referral_notes_note_type_chk CHECK (
        note_type IN ('manual', 'auto_extract', 'auto_eligibility', 'system')
    )
);

-- -------------------------------------------------------------------------
-- referral_documents
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.referral_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    referral_id     uuid        NOT NULL
                                REFERENCES crm.referrals (id) ON DELETE CASCADE,
    filename        text        NOT NULL,
    s3_key          text        NOT NULL,
    content_type    text,
    size_bytes      bigint,
    uploaded_by     uuid        REFERENCES crm.users (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- bd_visits
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.bd_visits (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    org_id          uuid        NOT NULL
                                REFERENCES crm.organizations (id) ON DELETE RESTRICT,
    user_id         uuid        NOT NULL
                                REFERENCES crm.users (id) ON DELETE RESTRICT,
    visit_date      date        NOT NULL,
    contacts_met    uuid[],
    notes           text,
    lat             double precision,
    lng             double precision,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- audit_log — append-only. No updated_at column.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm.audit_log (
    id              bigserial   PRIMARY KEY,
    tenant_id       uuid        NOT NULL
                                REFERENCES crm.tenants (id) ON DELETE RESTRICT,
    user_id         uuid,
    action          text        NOT NULL,
    resource_type   text        NOT NULL,
    resource_id     uuid,
    ip_address      inet,
    user_agent      text,
    metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crm.audit_log IS
    'Append-only audit trail. UPDATE/DELETE blocked by RLS policies in 0001_rls_policies.sql.';
