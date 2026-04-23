-- =========================================================================
-- christina-crm-inspect — Verifier schema (v2 draft)
--
-- Depends on: crm-migration-add-county.sql (owned by CRM team, must run first).
-- This file does NOT alter any crm.* table — VR-008 forbids cross-schema
-- writes. The `county` column on crm.referrals is provisioned by the CRM
-- team's own migration chain; we only read it by value when the CRM app
-- projects it into `ReferralInput` for the evaluator.
--
-- Scope:
--   CREATE SCHEMA verification with 5 tables + FORCE RLS + indexes + triggers.
--
-- Architectural note (VR-008):
--   The verifier is a separate app. There are NO foreign keys from
--   verification.* into crm.*. `referral_id` is a loose UUID reference.
--
-- Tenancy:
--   Every table in verification.* carries `tenant_id uuid NOT NULL` and is
--   guarded by a FORCE-RLS policy bound to current_setting('app.tenant_id').
--   Policies fail closed: when app.tenant_id is unset, zero rows match.
--   Assumes the caller executes:
--     SELECT set_config('app.tenant_id', $1, false);
--
-- Zero PHI:
--   Seed data contains only rule metadata. No member names, DOBs, SSNs, or
--   clinical content appear in this file.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1. verification schema
-- -------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS verification;

COMMENT ON SCHEMA verification IS
    'christina-crm-inspect verifier app. Loose-coupled to crm.* via UUID only (VR-008).';


-- -------------------------------------------------------------------------
-- 2. verification.rules — rule catalog (VR-001..VR-009)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification.rules (
    id              text        PRIMARY KEY,          -- 'VR-001' .. 'VR-009'
    category        text        NOT NULL
                                CHECK (category IN ('Routing', 'Policy', 'Architecture', 'Global')),
    action          text        NOT NULL
                                CHECK (action IN ('PASS', 'BLOCK', 'MANUAL', 'PASS_OR_MANUAL', 'NONE')),
    active          boolean     NOT NULL DEFAULT true,
    version         integer     NOT NULL DEFAULT 1,
    description     text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification.rules IS
    'Static rule catalog. Evaluator code is the source of truth; this table mirrors it for UI/audit. Edits require a superuser migration, not an API route.';


-- -------------------------------------------------------------------------
-- 3. verification.evaluations — one row per evaluator run
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification.evaluations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid        NOT NULL,
    -- Loose reference to crm.referrals.id (NO FK — VR-008).
    referral_id         uuid        NOT NULL,
    payer_type          text        NOT NULL
                                    CHECK (payer_type IN (
                                        'medicare_ffs',
                                        'medi_cal_mco',
                                        'medicare_advantage',
                                        'commercial',
                                        'self_pay'
                                    )),
    payer_plan_name     text,
    county              text        CHECK (
                                        county IS NULL
                                        OR county IN (
                                            'los_angeles',
                                            'san_bernardino',
                                            'riverside',
                                            'orange',
                                            'san_diego'
                                        )
                                    ),
    decision            text        NOT NULL
                                    CHECK (decision IN ('PASS', 'BLOCK', 'MANUAL_REVIEW')),
    pipeline            text        CHECK (
                                        pipeline IS NULL
                                        OR pipeline IN (
                                            'intake',
                                            'eligibility_queue',
                                            'manual_review_queue',
                                            'rejected'
                                        )
                                    ),
    reason_code         text        NOT NULL,
    rule_fired          text        NOT NULL
                                    REFERENCES verification.rules (id),
    payer_matched       boolean     NOT NULL DEFAULT false,
    trace               jsonb       NOT NULL DEFAULT '[]'::jsonb,
    evaluated_at        timestamptz NOT NULL DEFAULT now(),
    -- NULL => automated evaluator run; set for manual re-evaluations.
    evaluated_by        uuid,
    evaluation_source   text        NOT NULL DEFAULT 'automated'
                                    CHECK (evaluation_source IN ('automated', 'manual_review', 'replay'))
);

COMMENT ON TABLE verification.evaluations IS
    'Append-only log of every evaluator decision. referral_id is a soft UUID reference to crm.referrals.id.';

CREATE INDEX IF NOT EXISTS evaluations_referral_id_idx
    ON verification.evaluations (referral_id);
CREATE INDEX IF NOT EXISTS evaluations_decision_idx
    ON verification.evaluations (decision);
CREATE INDEX IF NOT EXISTS evaluations_tenant_evaluated_at_idx
    ON verification.evaluations (tenant_id, evaluated_at DESC);


-- -------------------------------------------------------------------------
-- 4. verification.manual_review_queue — reviewer workload
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification.manual_review_queue (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid        NOT NULL,
    evaluation_id    uuid        NOT NULL
                                 REFERENCES verification.evaluations (id) ON DELETE RESTRICT,
    assigned_to      uuid,
    status           text        NOT NULL DEFAULT 'open'
                                 CHECK (status IN ('open', 'claimed', 'approved', 'rejected')),
    resolved_at      timestamptz,
    resolved_by      uuid,
    override_reason  text,
    created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification.manual_review_queue IS
    'Reviewer queue for MANUAL_REVIEW decisions. One row per evaluation that needs human eyes.';

CREATE INDEX IF NOT EXISTS manual_review_queue_status_created_at_idx
    ON verification.manual_review_queue (status, created_at);
CREATE INDEX IF NOT EXISTS manual_review_queue_tenant_status_idx
    ON verification.manual_review_queue (tenant_id, status);
CREATE INDEX IF NOT EXISTS manual_review_queue_assigned_to_idx
    ON verification.manual_review_queue (assigned_to)
    WHERE assigned_to IS NOT NULL;


-- -------------------------------------------------------------------------
-- 5. verification.contracted_plans — panel catalog
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification.contracted_plans (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL,
    payer_type      text        NOT NULL
                                CHECK (payer_type IN (
                                    'medi_cal_mco',
                                    'medicare_advantage',
                                    'commercial'
                                )),
    plan_name       text        NOT NULL,
    -- county is required for medi_cal_mco and medicare_advantage;
    -- commercial is the only global-contract payer (county may be NULL).
    county          text        CHECK (
                                    county IS NULL
                                    OR county IN (
                                        'los_angeles',
                                        'san_bernardino',
                                        'riverside',
                                        'orange',
                                        'san_diego'
                                    )
                                ),
    effective_from  date        NOT NULL,
    effective_to    date,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contracted_plans_effective_range_chk
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT contracted_plans_county_requirement_chk
        CHECK (payer_type = 'commercial' OR county IS NOT NULL)
);

-- Single unique index covering all rows. MCO + MA always have a non-null
-- county (enforced by contracted_plans_county_requirement_chk); Commercial
-- rows have county=NULL which PostgreSQL treats as distinct by default —
-- that is desired: a single commercial global contract per (tenant, plan).
CREATE UNIQUE INDEX IF NOT EXISTS contracted_plans_unique_with_county_idx
    ON verification.contracted_plans (tenant_id, payer_type, plan_name, county);

COMMENT ON TABLE verification.contracted_plans IS
    'Contracted-panel catalog for VR-002/VR-003/VR-004. Empty OK in MVP — unknown plans fall to MANUAL_REVIEW, never crash. MCO and MA are per-county; Commercial is global.';


-- -------------------------------------------------------------------------
-- 6. verification.override_log — immutable audit trail
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification.override_log (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid        NOT NULL,
    evaluation_id       uuid        NOT NULL
                                    REFERENCES verification.evaluations (id) ON DELETE RESTRICT,
    manual_review_id    uuid        REFERENCES verification.manual_review_queue (id) ON DELETE RESTRICT,
    action              text        NOT NULL
                                    CHECK (action IN (
                                        'approve',
                                        'reject',
                                        'reassign',
                                        'reopen',
                                        'comment'
                                    )),
    actor               uuid        NOT NULL,
    reason              text        NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE verification.override_log IS
    'Append-only audit trail for manual actions on evaluations. No updates, no deletes — enforced by RLS + trigger below.';

CREATE INDEX IF NOT EXISTS override_log_evaluation_id_idx
    ON verification.override_log (evaluation_id);
CREATE INDEX IF NOT EXISTS override_log_tenant_created_at_idx
    ON verification.override_log (tenant_id, created_at DESC);

-- Hard-enforce immutability at the DB layer.
CREATE OR REPLACE FUNCTION verification.reject_override_log_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'verification.override_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS override_log_no_update ON verification.override_log;
CREATE TRIGGER override_log_no_update
    BEFORE UPDATE OR DELETE ON verification.override_log
    FOR EACH ROW EXECUTE FUNCTION verification.reject_override_log_mutation();


-- -------------------------------------------------------------------------
-- 7. updated_at touch triggers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verification.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rules_touch_updated_at ON verification.rules;
CREATE TRIGGER rules_touch_updated_at
    BEFORE UPDATE ON verification.rules
    FOR EACH ROW EXECUTE FUNCTION verification.touch_updated_at();

DROP TRIGGER IF EXISTS contracted_plans_touch_updated_at ON verification.contracted_plans;
CREATE TRIGGER contracted_plans_touch_updated_at
    BEFORE UPDATE ON verification.contracted_plans
    FOR EACH ROW EXECUTE FUNCTION verification.touch_updated_at();


-- -------------------------------------------------------------------------
-- 8. Row-Level Security (FORCE + fail-closed)
-- -------------------------------------------------------------------------
ALTER TABLE verification.rules                ENABLE  ROW LEVEL SECURITY;
ALTER TABLE verification.rules                FORCE   ROW LEVEL SECURITY;
ALTER TABLE verification.evaluations          ENABLE  ROW LEVEL SECURITY;
ALTER TABLE verification.evaluations          FORCE   ROW LEVEL SECURITY;
ALTER TABLE verification.manual_review_queue  ENABLE  ROW LEVEL SECURITY;
ALTER TABLE verification.manual_review_queue  FORCE   ROW LEVEL SECURITY;
ALTER TABLE verification.contracted_plans     ENABLE  ROW LEVEL SECURITY;
ALTER TABLE verification.contracted_plans     FORCE   ROW LEVEL SECURITY;
ALTER TABLE verification.override_log         ENABLE  ROW LEVEL SECURITY;
ALTER TABLE verification.override_log         FORCE   ROW LEVEL SECURITY;

-- rules is catalog/global (no tenant_id). Read-all for authenticated callers;
-- FORCE RLS still applies, so rule edits must go through a superuser
-- migration — NOT an API route.
DROP POLICY IF EXISTS rules_read_all ON verification.rules;
CREATE POLICY rules_read_all ON verification.rules
    FOR SELECT USING (true);

-- Tenant-isolation policies. Every USING / WITH CHECK is fail-closed: when
-- app.tenant_id is NULL or unset, zero rows match and writes are rejected.
DROP POLICY IF EXISTS evaluations_tenant_isolation ON verification.evaluations;
CREATE POLICY evaluations_tenant_isolation ON verification.evaluations
    USING (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    );

DROP POLICY IF EXISTS manual_review_queue_tenant_isolation ON verification.manual_review_queue;
CREATE POLICY manual_review_queue_tenant_isolation ON verification.manual_review_queue
    USING (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    );

DROP POLICY IF EXISTS contracted_plans_tenant_isolation ON verification.contracted_plans;
CREATE POLICY contracted_plans_tenant_isolation ON verification.contracted_plans
    USING (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    );

DROP POLICY IF EXISTS override_log_tenant_isolation ON verification.override_log;
CREATE POLICY override_log_tenant_isolation ON verification.override_log
    USING (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NOT NULL
        AND tenant_id::text = current_setting('app.tenant_id', true)
    );


-- -------------------------------------------------------------------------
-- 9. Seed verification.rules (VR-001..VR-009) — metadata only, zero PHI
-- -------------------------------------------------------------------------
INSERT INTO verification.rules (id, category, action, active, version, description) VALUES
    ('VR-001', 'Routing',      'PASS',           true,  1,
        'Medicare FFS referrals auto-pass. MAC jurisdiction TBD; no contracted-panel gate. VR-007 MBI check owned by the FFS router.'),
    ('VR-002', 'Routing',      'PASS_OR_MANUAL', true,  1,
        'Medi-Cal MCO is county-gated (LA, San Bernardino, Riverside, Orange, San Diego). Unknown MCO in-county routes to manual review. County NULL is blocked by VR-009. VR-007 member-id check owned by the MCO router.'),
    ('VR-003', 'Routing',      'PASS_OR_MANUAL', true,  1,
        'Medicare Advantage is contracted-panel-only AND county-gated like MCO (no global MA auto-pass). Unknown plan or unknown in-county panel routes to manual review. County NULL is blocked by VR-009. VR-007 member-id check owned by the MA router.'),
    ('VR-004', 'Routing',      'PASS_OR_MANUAL', true,  1,
        'Commercial is contracted-panel-only (global, not county-gated). Unknown plan routes to manual review. VR-007 member-id check owned by the Commercial router.'),
    ('VR-005', 'Routing',      'MANUAL',         true,  1,
        'Self-Pay routes to manual review until a signed financial agreement is on file. No member_id required.'),
    ('VR-006', 'Policy',       'NONE',           true,  1,
        'Eligibility source is manual entry in MVP. Stedi 270/271 wired post-MVP via resolveEligibility seam.'),
    ('VR-007', 'Policy',       'PASS_OR_MANUAL', true,  1,
        'Member-ID capture policy, enforced per-payer in the evaluator. Each per-payer router owns its own VR-007 check (FFS/MBI, MCO/member_id, MA/plan-member-id, Commercial/plan-member-id). Missing member-id routes to MANUAL_REVIEW, not BLOCK — intake may arrive before capture.'),
    ('VR-008', 'Architecture', 'NONE',           true,  1,
        'christina-crm-inspect is a separate Verifier app with its own verification.* schema and UI. No cross-schema FK into crm.*; reference crm.referrals.id by UUID only.'),
    -- VR-009 ships inactive. Flip to true only after backfill gate passes;
    -- see crm-migration-add-county.sql checklist.
    ('VR-009', 'Global',       'BLOCK',          false, 1,
        'payer_type in (medi_cal_mco, medicare_advantage) AND county IS NULL => BLOCK. No admin override. Fires before per-payer routing. active=false in this seed; flip to true only after crm.referrals.county backfill gate passes.')
ON CONFLICT (id) DO UPDATE SET
    category    = EXCLUDED.category,
    action      = EXCLUDED.action,
    active      = EXCLUDED.active,
    version     = EXCLUDED.version,
    description = EXCLUDED.description,
    updated_at  = now();
