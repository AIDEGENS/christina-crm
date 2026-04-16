# Phase 1 — Referral Core

**Duration:** Days 3-5 of MVP sprint
**Goal:** A user can create a referral by hand, see it on the pipeline kanban, drag it through stages, and open a detail view.

## Steps

| ID | Step | File | Status |
|---|---|---|---|
| 1.1 | Referral CRUD (API + form) | `1.1-referral-crud.md` | STUB — write before execution |
| 1.2 | Pipeline kanban UI | `1.2-pipeline-kanban.md` | STUB |
| 1.3 | Referral detail page | `1.3-referral-detail.md` | STUB |
| 1.4 | Notes + document upload | `1.4-notes-documents.md` | STUB |

## Parallel opportunities

After 1.1: 1.2 and 1.3 can run in parallel (different pages, same data model).

## What to build (summary — expand in each step file)

### 1.1 Referral CRUD
- Drizzle queries: `createReferral`, `getReferral`, `listReferralsByTenant`, `updateReferralStatus`
- API routes in `crm-api` or Next.js server actions in `crm-web`
- Form UI in `/referrals/new`: patient initials, age, sex, primary dx, payer, orders, source org, referring physician
- Audit log write on every mutation
- All queries wrapped in `withTenantContext`

### 1.2 Pipeline kanban UI
- 5 columns: New, Eligibility, SOC Scheduled, Admitted, Lost/Denied
- Drag-and-drop with `@dnd-kit/core` (or simpler: click-menu to move)
- Cards show: patient initials, age, primary dx, payer badge, source org, time in stage
- SLA color indicators: yellow at 12h, red at 24h
- Filter by: assigned user, payer, source org

### 1.3 Referral detail page
- 3-column layout: clinical summary | timeline | documents/notes
- Matches the mockup in `../../REF/hh-crm-mockup.html` (referral detail view)
- Patient card with initials-only display + click-through to full PHI (audit logged)
- Timeline shows: created → reviewed → eligibility → SOC → admitted
- Action buttons: assign nurse, move stage, print H&P placeholder

### 1.4 Notes + document upload
- Add note textarea on referral detail
- Notes stored in `crm.referral_notes` with author + timestamp
- Document upload placeholder → S3 presigned URL (multipart from browser)
- Files listed in right column of detail page

## Exit criteria

- [ ] Can create a referral via UI, stored in DB with correct tenant_id
- [ ] Pipeline kanban shows the new referral in "New" column
- [ ] Can move referral through all 5 columns (drag or click)
- [ ] Detail page shows all referral data + timeline + notes + documents
- [ ] All actions write to audit_log
- [ ] RLS verified: user in tenant A cannot see tenant B's referrals
- [ ] Cannot proceed to Phase 2 until all boxes checked

## Reference
- Data model: `../../REF/CRM-03-DATA-MODEL.md` (crm.referrals table)
- Feature spec: `../../REF/CRM-05-FEATURE-SPEC-V1.md` (M1, M2, M9)
- UI mockup: `../../REF/hh-crm-mockup.html`
