# CRM-09 — Migration from WellSky

> How to get the client off WellSky's BD/referral layer and onto our CRM without losing data or disrupting operations.

## Migration strategy: phased dual-run

The client does NOT stop using WellSky on day 1. Instead:

1. **Week 1-2:** Import historical data from WellSky into CRM
2. **Week 3-4:** Dual-run — new referrals entered in CRM; WellSky used for clinical/billing
3. **Week 5-6:** CRM is primary for referrals; WellSky used only for clinical docs + billing
4. **Week 7+:** WellSky retained for clinical/billing only; BD/referral layer fully on CRM

This matches the platform roadmap: CRM handles front-of-funnel, claims platform handles billing, WellSky handles clinical until we build that module.

## Data extraction from WellSky

### What to extract

| Data type | WellSky location | Export method | Priority |
|---|---|---|---|
| Referral sources (orgs) | PlayMaker or WellSky | CSV export or manual list | P0 — needed day 1 |
| Physician contacts | PlayMaker | CSV export | P0 |
| Historical referrals (6-12mo) | WellSky referral module | CSV/SFTP | P1 — needed for dashboards |
| Active episodes | WellSky episode list | CSV | P1 — import as "admitted" referrals |
| Patient demographics | WellSky patient table | CSV/SFTP | P2 — encrypted import |
| BD visit history | PlayMaker | CSV or manual | P2 |
| Payer information | WellSky billing | CSV | P2 |

### How to extract

WellSky's API is gated and expensive. Realistic v1 options:

1. **CSV export from WellSky reports** — most agencies can run custom reports and export to CSV. Ask the client's WellSky admin to generate:
   - Referral source list (org name, address, NPI, phone, fax)
   - Physician contact list (name, NPI, phone, org affiliation)
   - Referral history (last 12 months: patient MRN, initials, dx, payer, source org, referral date, status, SOC date)
   - Active episode list (MRN, dx, payer, start date, status)

2. **SFTP scheduled export** — if the client has WellSky configured for scheduled SFTP exports (some agencies do for billing), tap into the existing export.

3. **Manual entry** — for small data sets (e.g., 20 key referral sources), manual entry in the CRM UI is faster than building an ETL.

**[CONFIRM]** Can the client's WellSky admin run custom reports and export CSV?

### Import pipeline

```
[Client exports CSV] → [Upload to S3] → [Inngest: import-wellsky]
                                              │
                                         Parse + validate
                                         Map WellSky fields → CRM schema
                                         De-duplicate against existing records
                                              │
                                         [RDS: crm.organizations, contacts, referrals]
```

- Import is idempotent (can re-run without duplicates)
- Matching on NPI for orgs/contacts, MRN for patients
- Import logged in audit trail
- PHI in CSV → encrypted in transit (TLS) and at rest (S3 + RDS)

## Field mapping

### Organizations (WellSky → CRM)

| WellSky field | CRM field | Notes |
|---|---|---|
| Facility Name | `name` | |
| Facility Type | `type` | Map to enum |
| NPI | `npi` | Primary match key |
| Address | `address` | Parse into jsonb |
| Phone | `phone` | |
| Fax | `fax` | |

### Contacts (WellSky → CRM)

| WellSky field | CRM field | Notes |
|---|---|---|
| Physician Name | `first_name`, `last_name` | Split |
| NPI | `npi` | Primary match key |
| Specialty | `role` | |
| Phone | `phone` | |
| Facility | `org_id` | FK lookup by NPI |

### Referrals (WellSky → CRM)

| WellSky field | CRM field | Notes |
|---|---|---|
| Patient MRN | `patient_mrn` | Encrypted |
| Patient Name | `patient_initials` | Convert to initials |
| Date of Birth | `patient_dob` | Encrypted |
| Sex | `patient_sex` | |
| Primary Dx | `primary_dx_code`, `primary_dx_desc` | |
| Payer | `payer_type`, `payer_name` | Map to enum |
| Referral Source | `source_org_id` | FK lookup by name/NPI |
| Referral Date | `created_at` | |
| SOC Date | `soc_date` | |
| Status | `status` | Map: Active→admitted, Pending→new, Discharged→admitted (historical) |

## Dual-run protocol

During weeks 3-6, both systems are active:

| Activity | Where |
|---|---|
| New referral intake | CRM (primary) |
| Eligibility check | CRM (auto via Stedi) |
| SOC scheduling | CRM |
| Clinical documentation (OASIS, visit notes) | WellSky |
| Billing / 837I | WellSky (or claims platform if ready) |
| BD rep visits | CRM |
| Reports (referral) | CRM |
| Reports (clinical/billing) | WellSky |

The client enters referral data ONCE in the CRM. Clinical staff still use WellSky for visit notes and OASIS. No double data entry.

## Cutover criteria

Switch from dual-run to CRM-primary when:

- [ ] All referral sources (organizations) imported and verified
- [ ] All physician contacts imported and verified
- [ ] 2 weeks of new referrals successfully processed in CRM
- [ ] Eligibility auto-check working for Medicare + Medi-Cal
- [ ] Dashboard showing accurate metrics
- [ ] At least 2 users trained and comfortable
- [ ] No critical bugs in last 5 business days
- [ ] Client sign-off on migration readiness

## Rollback plan

If CRM has critical issues during dual-run:
- All data remains in CRM (no data loss)
- Client reverts to WellSky for BD/referral
- CRM data can be re-imported to WellSky via CSV if needed (unlikely)
- No PHI is deleted during rollback
