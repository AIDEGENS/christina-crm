# Phase 3 — Dashboard & Tenant Switching

**Duration:** Days 9-10 of MVP sprint
**Goal:** Client sees a dashboard that feels better than WellSky in 3 seconds. Can switch HH ↔ Hospice tenants. RLS verified end-to-end.

## Steps

| ID | Step | File | Status |
|---|---|---|---|
| 3.1 | Dashboard KPIs | `3.1-dashboard-kpis.md` | STUB |
| 3.2 | Activity feed | `3.2-activity-feed.md` | STUB |
| 3.3 | Tenant switcher UI | `3.3-tenant-switcher.md` | STUB |
| 3.4 | RLS validation test suite | `3.4-rls-validation.md` | STUB |

## Parallel opportunities

3.3 can start as soon as 0.4 (WorkOS auth) is done. 3.1 and 3.2 build on Phase 1/2 data.

## What to build (summary)

### 3.1 Dashboard KPIs
- 4 KPI tiles: new referrals (7d), conversion to SOC %, pipeline count, active episodes
- Referral velocity mini-chart (14 days, inbound vs admitted)
- Top referral sources bar chart
- Matches mockup dashboard layout

### 3.2 Activity feed
- Recent events: new referral, status change, org added, contact added, visit logged
- Query `crm.audit_log` filtered to display-friendly actions
- User avatars, timestamps, action descriptions
- "Needs your attention" panel: SLA breaches, failed eligibility, unassigned

### 3.3 Tenant switcher UI
- Dropdown in top nav (matches mockup)
- Shows tenants the current user has access to (from crm.users rows)
- On switch: update session cookie, trigger page reload, next request uses new tenant_id
- Visual confirmation (checkmark on current tenant)

### 3.4 RLS validation test suite
- Playwright/Vitest tests that verify:
  - User in tenant A cannot query tenant B's referrals via API
  - Switching tenants in UI shows different data
  - Direct API call with forged tenant_id is blocked by RLS
  - audit_log cannot be UPDATE/DELETE
- CI must run these on every PR

## Exit criteria

- [ ] Dashboard shows real data for current tenant
- [ ] Switching tenant in UI shows different counts/data
- [ ] RLS test suite passes 100%
- [ ] Activity feed renders last 10 events
- [ ] "Needs attention" panel surfaces SLA breaches

## Reference
- Mockup: `../../REF/hh-crm-mockup.html` (dashboard view)
- Feature spec: `../../REF/CRM-05-FEATURE-SPEC-V1.md` (M6, M7)
- RLS policies: set in step 0.3
