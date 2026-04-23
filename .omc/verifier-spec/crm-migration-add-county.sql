-- =========================================================================
-- crm-migration-add-county.sql
--
-- OWNERSHIP: CRM team (packages/db).
-- This file is owned by the CRM codebase, NOT the verifier. It lives inside
-- the verifier-spec directory ONLY because the verifier depends on this
-- column existing in `crm.referrals`. When `packages/db/migrations/` lands,
-- the CRM team will MOVE this file into that directory and run it as part of
-- the CRM migration chain. The verifier's own schema.sql will NEVER alter
-- `crm.*` tables (VR-008: loose-coupled separate app, UUID reference only).
--
-- Purpose:
--   Add a nullable `county` column to crm.referrals. County is enforced at
--   routing time (VR-009) by the verifier, not by this schema. Nullable at
--   the column level so legacy rows migrate cleanly; backfill happens before
--   the verifier's VR-009 rule is flipped active.
-- =========================================================================

ALTER TABLE crm.referrals
    ADD COLUMN IF NOT EXISTS county text
        CHECK (
            county IS NULL
            OR county IN (
                'los_angeles',
                'san_bernardino',
                'riverside',
                'orange',
                'san_diego'
            )
        );

COMMENT ON COLUMN crm.referrals.county IS
    'Service county (VR-009). Required at routing time for Medi-Cal MCO and Medicare Advantage; intake must backfill before VR-009 is flipped active in verification.rules.';


-- -------------------------------------------------------------------------
-- VR-009 enablement checklist
-- -------------------------------------------------------------------------
-- Before flipping VR-009 to active=true in verification.rules, run:
--   SELECT COUNT(*) FROM crm.referrals
--   WHERE county IS NULL AND payer_type IN ('medi_cal_mco','medicare_advantage');
-- This MUST return 0. If not, backfill intake data first.
