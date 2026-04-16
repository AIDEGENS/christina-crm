# Phase 5 — Demo Prep

**Duration:** Days 13-14 of MVP sprint
**Goal:** Realistic seed data loaded, basic notifications working, demo walkthrough rehearsed, client ready to see it.

## Steps

| ID | Step | File | Status |
|---|---|---|---|
| 5.1 | Seed realistic demo data | `5.1-seed-data.md` | STUB |
| 5.2 | Email notification (new referral) | `5.2-email-notifications.md` | STUB |
| 5.3 | Demo walkthrough script | `5.3-demo-script.md` | STUB |
| 5.4 | Client demo handoff | `5.4-handoff.md` | STUB |

## What to build (summary)

### 5.1 Seed realistic demo data
- Both tenants populated:
  - **Meridian HH:** 6 orgs, 12 contacts, 20 referrals (5 in each pipeline stage)
  - **Meridian Hospice:** 3 orgs, 6 contacts, 10 referrals (lighter data)
- Use fake initials + fake MRNs (never real PHI)
- Realistic org names: Mercy General, Sutter Roseville, Pine Ridge SNF
- Realistic dx codes: Z47.1 (aftercare), I50.9 (CHF), J44.9 (COPD)
- Script: `packages/db/src/seed-demo.ts`

### 5.2 Email notification (new referral)
- On new referral creation, send email to `assigned_to` user
- Subject: "New referral from [source org]"
- Body: link to `/referrals/{id}` (NO PHI in body)
- Via SES (AWS BAA)
- Failure does not block referral creation (best-effort)

### 5.3 Demo walkthrough script
- 10-minute talk track:
  1. Login + dashboard (30s — impression)
  2. Create a referral manually (60s — the word-of-mouth use case)
  3. Move through pipeline (60s — feel the speed)
  4. Open detail view (45s — clinical summary + timeline)
  5. Add a note (15s)
  6. Browse organizations (60s — scorecard)
  7. Drill into an org (45s — referrals from this source)
  8. Switch to Hospice tenant (30s — multi-tenant)
  9. Show mobile view (60s — open on phone)
  10. Settings + HIPAA posture (30s — trust)
  11. Price comparison + ask (90s)
- Rehearse on a fresh browser session with seed data loaded
- Record backup video in case live demo has issues

### 5.4 Client demo handoff
- Schedule demo call
- Share deployment URL + temporary credentials
- Hand off demo recording as fallback
- Collect feedback: what they loved, what's missing, what to prioritize next

## Exit criteria

- [ ] Demo data loaded in both tenants
- [ ] Email notifications working end-to-end
- [ ] Walkthrough rehearsed to < 12 minutes
- [ ] Demo URL shared with client
- [ ] Demo scheduled / completed
- [ ] Client feedback captured in `STATUS.md` decisions log

## After the demo

If client says "keep building" → move to `../post-mvp/README.md` for weeks 3-10 plan.
If client gives specific feedback → add to `STATUS.md`, adjust post-MVP priorities.
If client says "pass" → document learnings, salvage work for vertical SaaS pivot.
