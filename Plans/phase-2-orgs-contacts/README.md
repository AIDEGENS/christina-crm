# Phase 2 — Organizations & Contacts

**Duration:** Days 6-8 of MVP sprint
**Goal:** Manage the referral source network. Orgs (hospitals, SNFs, practices) and contacts (physicians, case managers) with NPPES enrichment and scorecards.

## Steps

| ID | Step | File | Status |
|---|---|---|---|
| 2.1 | Organization CRUD | `2.1-organization-crud.md` | STUB |
| 2.2 | NPPES NPI lookup | `2.2-nppes-lookup.md` | STUB |
| 2.3 | Contact directory CRUD | `2.3-contact-crud.md` | STUB |
| 2.4 | Organization scorecards | `2.4-scorecards.md` | STUB |

## Parallel opportunities

After 2.1: 2.2 and 2.3 in parallel.

## What to build (summary — expand in each step file)

### 2.1 Organization CRUD
- Form: name, type (acute/SNF/physician/hospice/other), NPI, address, phone, fax, assigned BD rep, notes
- List view matching mockup (table with columns from `hh-crm-mockup.html`)
- Detail page: org info + scorecard + contacts list + referral history

### 2.2 NPPES NPI lookup
- Public API: `https://npiregistry.cms.hhs.gov/api/?version=2.1&number={npi}`
- On NPI entry in org form → auto-fill name, address, phone
- Cache results in `crm.organizations.metadata` to avoid re-calling (rate-limited)
- No auth needed (public API, no PHI)

### 2.3 Contact directory CRUD
- Form: first name, last name, title, role, NPI, phone, email, preferred contact, org (dropdown)
- List view with search + filter by org
- Detail view showing referrals they sent

### 2.4 Organization scorecards
- Per-org metrics: 30d referrals, conversion %, avg time-to-SOC, last contact date
- SQL query against `crm.referrals` grouped by `source_org_id`
- Color-coded staleness: green < 10 days, amber 10-30, red > 30
- Displayed in org list + org detail

## Exit criteria

- [ ] Can add org, NPPES auto-fills name/address/phone
- [ ] Can add contacts linked to orgs
- [ ] Org list shows scorecard with 30d referrals and conversion
- [ ] Stale orgs flagged
- [ ] Org detail page shows full referral history
- [ ] Phase 1 pipeline cards link to source org correctly

## Reference
- Data model: `../../REF/CRM-03-DATA-MODEL.md` (crm.organizations, crm.contacts)
- Feature spec: `../../REF/CRM-05-FEATURE-SPEC-V1.md` (M4, M5)
- NPPES: `../../Insurance Claims/REF/API-INVENTORY.md`
