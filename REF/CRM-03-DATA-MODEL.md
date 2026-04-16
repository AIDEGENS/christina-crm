# CRM-03 — Data Model

> Postgres on AWS RDS. Row-level security on `tenant_id`. All PHI columns encrypted at rest (KMS) and in transit (TLS 1.3). Schema lives in the same RDS cluster as the claims platform, separate `crm` schema.

## Core entities

### `crm.tenants`
Multi-tenant root. One row per agency.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | "Meridian Home Health, LLC" |
| `npi` | text | Organization NPI |
| `ein` | text | Encrypted |
| `medicare_ptan` | text | Provider Transaction Access Number |
| `mac_jurisdiction` | text | "noridian_je", "ngs_j6", etc. |
| `medi_cal_provider_id` | text | |
| `service_area` | text[] | Counties served |
| `stripe_customer_id` | text | Billing link (no PHI in Stripe) |
| `created_at` | timestamptz | |

### `crm.users`
Managed by WorkOS. Local shadow table for app-level roles.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | RLS filter |
| `workos_user_id` | text | WorkOS canonical ID |
| `email` | text | |
| `display_name` | text | |
| `role` | enum | admin, intake, bd_rep, viewer |
| `active` | boolean | Soft deactivation |
| `created_at` | timestamptz | |

### `crm.organizations`
Referring entities: hospitals, SNFs, physician practices.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | RLS |
| `name` | text | "Mercy General Hospital" |
| `type` | enum | acute_care, snf, physician, hospice_facility, other |
| `npi` | text | Organization NPI (from NPPES) |
| `address` | jsonb | `{line1, line2, city, state, zip, lat, lng}` |
| `phone` | text | |
| `fax` | text | |
| `owner_user_id` | uuid FK → users | BD rep assigned |
| `last_contact_at` | timestamptz | Last BD visit or communication |
| `metadata` | jsonb | Flexible KV for custom fields |
| `created_at` | timestamptz | |

### `crm.contacts`
People at organizations: physicians, case managers, discharge planners.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | RLS |
| `org_id` | uuid FK → organizations | |
| `first_name` | text | |
| `last_name` | text | |
| `title` | text | "MD", "RN", "BSW" |
| `role` | text | "cardiologist", "case_manager", "discharge_planner" |
| `npi` | text | Individual NPI (physicians only) |
| `phone` | text | |
| `email` | text | |
| `preferred_contact` | enum | phone, email, fax, in_person |
| `notes` | text | |
| `created_at` | timestamptz | |

### `crm.referrals`
Core entity. One row per patient referral.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | RLS |
| `ref_number` | text | Human-readable: "RK-4821" |
| `status` | enum | new, eligibility, soc_scheduled, admitted, lost, denied |
| `source_org_id` | uuid FK → organizations | Where the referral came from |
| `source_contact_id` | uuid FK → contacts | Who sent it |
| `intake_channel` | enum | fax, email, e_referral, phone, walk_in |
| `patient_initials` | text | "R.K." — display-safe identifier |
| `patient_age` | int | |
| `patient_sex` | enum | m, f, other |
| `patient_dob` | date | PHI — encrypted |
| `patient_mrn` | text | PHI — encrypted |
| `patient_address` | jsonb | PHI — encrypted |
| `primary_dx_code` | text | ICD-10 |
| `primary_dx_desc` | text | |
| `secondary_dx` | jsonb | Array of {code, desc} |
| `payer_type` | enum | medicare_a, medicare_b, medi_cal, ma_plan, private, other |
| `payer_name` | text | "Humana Medicare Advantage" |
| `payer_member_id` | text | PHI — encrypted |
| `orders` | text[] | ["SN 2-3x/wk", "PT 3x/wk", "OT 2x/wk"] |
| `discharge_date` | date | From referring facility |
| `eligibility_status` | enum | pending, verified, failed, not_checked |
| `eligibility_checked_at` | timestamptz | |
| `eligibility_stedi_txn` | text | Stedi transaction ID for audit |
| `denial_risk_score` | int | 0-100, from scrubber |
| `soc_date` | date | Start of Care scheduled |
| `soc_nurse_id` | uuid FK → users | |
| `admitted_at` | timestamptz | |
| `lost_reason` | text | If status = lost/denied |
| `assigned_to` | uuid FK → users | Intake coordinator or BD rep |
| `ai_confidence` | float | Extraction confidence 0-1 |
| `raw_document_s3_key` | text | Original fax/email in S3 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `crm.referral_notes`
Timeline notes on a referral.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `referral_id` | uuid FK → referrals | |
| `tenant_id` | uuid FK → tenants | RLS |
| `author_user_id` | uuid FK → users | null = system/AI |
| `note_type` | enum | manual, auto_extract, auto_eligibility, system |
| `body` | text | |
| `created_at` | timestamptz | |

### `crm.referral_documents`
Documents attached to a referral (S3 references, not inline storage).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `referral_id` | uuid FK → referrals | |
| `tenant_id` | uuid FK → tenants | RLS |
| `filename` | text | "referral-packet.pdf" |
| `s3_key` | text | S3 object key |
| `content_type` | text | "application/pdf" |
| `size_bytes` | bigint | |
| `uploaded_by` | uuid FK → users | |
| `created_at` | timestamptz | |

### `crm.bd_visits`
BD rep visit logs at organizations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | RLS |
| `org_id` | uuid FK → organizations | |
| `user_id` | uuid FK → users | BD rep |
| `visit_date` | date | |
| `contacts_met` | uuid[] | FK → contacts |
| `notes` | text | |
| `lat` | float | GPS from mobile |
| `lng` | float | GPS from mobile |
| `created_at` | timestamptz | |

### `crm.audit_log`
Append-only. Every PHI access.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `tenant_id` | uuid | |
| `user_id` | uuid | |
| `action` | text | "read_referral", "update_referral", "export_report" |
| `resource_type` | text | "referral", "contact", "organization" |
| `resource_id` | uuid | |
| `ip_address` | inet | |
| `user_agent` | text | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | Immutable |

## Row-Level Security

Every table with `tenant_id` gets RLS:

```sql
CREATE POLICY tenant_isolation ON crm.referrals
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

Application sets `SET LOCAL app.current_tenant = '<uuid>'` per request via WorkOS session tenant.

## Indexes (critical)

```sql
-- Referral pipeline queries
CREATE INDEX idx_referrals_tenant_status ON crm.referrals(tenant_id, status);
CREATE INDEX idx_referrals_tenant_created ON crm.referrals(tenant_id, created_at DESC);
CREATE INDEX idx_referrals_source_org ON crm.referrals(source_org_id);

-- Org scorecards
CREATE INDEX idx_referrals_org_30d ON crm.referrals(source_org_id, created_at)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- BD visit tracking
CREATE INDEX idx_bd_visits_user_date ON crm.bd_visits(user_id, visit_date DESC);

-- Audit log (time-series queries)
CREATE INDEX idx_audit_tenant_time ON crm.audit_log(tenant_id, created_at DESC);
```

## Migration from claims platform schema

The claims platform uses a separate `claims` schema in the same RDS cluster. Shared tenant IDs. A referral that reaches admission creates a record in `claims.episodes` — this is the handoff point between CRM and scrubber.

```
crm.referrals (status=admitted) → claims.episodes (new episode created)
```

The join key is `referral_id` stored on the episode.
