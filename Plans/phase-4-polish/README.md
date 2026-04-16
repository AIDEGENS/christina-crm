# Phase 4 — Polish

**Duration:** Days 11-12 of MVP sprint
**Goal:** App works on a phone, search works, settings page exists, no janky loading states. Everything demo-ready.

## Steps

| ID | Step | File | Status |
|---|---|---|---|
| 4.1 | Responsive mobile layout | `4.1-responsive.md` | STUB |
| 4.2 | Global search (pg_trgm) | `4.2-search.md` | STUB |
| 4.3 | Settings page shell | `4.3-settings.md` | STUB |
| 4.4 | Loading / empty / error states | `4.4-ui-states.md` | STUB |

## Parallel opportunities

All 4 steps can run in parallel after Phase 3.4. Maximum fan-out point in the sprint.

## What to build (summary)

### 4.1 Responsive mobile layout
- Sidebar collapses to bottom nav or hamburger on < 768px
- Cards stack vertically
- Pipeline kanban becomes horizontal scroll
- BD reps can use the app from their phone
- Tested on iOS Safari + Android Chrome

### 4.2 Global search (pg_trgm)
- Cmd-K / Ctrl-K keyboard shortcut opens command palette
- Search across: referrals (by initials/MRN), orgs (name/NPI), contacts (name/NPI)
- Uses `pg_trgm` indexes created in step 0.3
- Results grouped by entity type
- Click to navigate

### 4.3 Settings page shell
- Tabs: Agency, Users, Integrations, Billing, Audit log, Compliance
- Matches mockup settings view
- Agency: display-only info (EIN, NPI, MAC jurisdiction)
- Users: list + invite button (invite = WorkOS + insert crm.users row)
- HIPAA posture: green checkmarks for active BAAs, KMS encryption, audit retention

### 4.4 Loading / empty / error states
- Skeleton loaders for pipeline cards, tables, lists
- Empty states with clear CTAs ("No referrals yet. Add your first →")
- Error boundaries with recovery actions
- No content flash during auth check

## Exit criteria

- [ ] App usable on iPhone SE (smallest common screen)
- [ ] Search returns results in < 300ms for 1000-row dataset
- [ ] Settings page renders without errors for admin user
- [ ] Every page has loading state, empty state, and error boundary
- [ ] No console errors in Chrome DevTools

## Reference
- Mockup: `../../REF/hh-crm-mockup.html` (settings view, BD mobile view)
- Feature spec: `../../REF/CRM-05-FEATURE-SPEC-V1.md` (polish items throughout)
