# CRM-10 — Roadmap & Timeline

> 10-week CRM build mapped to the claims platform's 6-month roadmap (see `Insurance Claims/REF/STRATEGY.md` § 8). The CRM is a parallel workstream — it can start before or alongside the scrubber.

## Phase 0 — Discovery & plan (Days 1-5)

**Status: IN PROGRESS (this document set)**

- [x] Competitive teardown (WellSky, PlayMaker, Axxess)
- [x] Data model design
- [x] Architecture decisions
- [x] Feature spec (MoSCoW)
- [x] Referral flow mapping
- [x] Integration inventory
- [x] Security/HIPAA controls
- [x] Migration plan
- [x] Pricing model
- [ ] **[CONFIRM]** answers from Clay (CRM-01-SCOPE.md open questions)
- [ ] Excalidraw diagram finalized
- [ ] Client demo of mockup → feedback → spec revision

**Deliverable:** Approved plan + mockup + client alignment

## Phase 1 — Foundation (Weeks 1-2)

| Task | Owner | Notes |
|---|---|---|
| Next.js 15 repo scaffold (App Router + TS + Tailwind + shadcn) | Builder | Monorepo with claims platform or separate repo — **[CONFIRM]** |
| Postgres `crm` schema + seed data | Builder | Per CRM-03-DATA-MODEL.md |
| RLS policies per table | Builder | Tenant isolation from day 1 |
| WorkOS integration (SSO, MFA, roles) | Builder | Shared with claims platform auth |
| S3 bucket + KMS key for fax/docs | Builder | Separate prefix per tenant |
| CI/CD (GitHub Actions → Vercel + ECS) | Builder | |
| Datadog agent + PHI scrubbing rules | Builder | |
| Audit log table + write middleware | Builder | Every API route logs |

**Deliverable:** Empty authenticated app. Login → see tenant dashboard (no data). Audit log writing.

## Phase 2 — Referral core (Weeks 2-4)

| Task | Owner | Notes |
|---|---|---|
| Referral CRUD API (create, read, update, list) | Builder | Hono routes |
| Pipeline kanban UI | Builder | 5 columns, drag-and-drop, filters |
| Referral detail page | Builder | Patient card, timeline, docs, notes |
| Fax intake: SES → S3 → Inngest pipeline | Builder | |
| Bedrock extraction prompt + response parsing | AI/Builder | Few-shot prompt with real referral examples |
| Stedi 270/271 integration | Builder | Auto on intake |
| Organization CRUD + scorecard queries | Builder | |
| Contact directory CRUD | Builder | NPPES NPI lookup on create |
| Search (referrals, orgs, contacts) | Builder | Postgres full-text or pg_trgm |

**Deliverable:** End-to-end demo: fax → AI parse → eligibility → pipeline card → detail view.

## Phase 3 — BD + reports + notifications (Weeks 4-6)

| Task | Owner | Notes |
|---|---|---|
| BD visit logging (desktop + mobile) | Builder | |
| Mobile responsive PWA | Builder | Service worker, offline visit logging, GPS |
| Dashboard with KPIs and charts | Builder | |
| Reports: referral velocity, BD scorecard, payer mix | Builder | |
| SLA breach alerts | Builder | |
| Email notifications (SES) | Builder | New referral, SLA breach, eligibility failed |
| SMS notifications (Twilio) — if confirmed | Builder | |
| Role-based access enforcement | Builder | bd_rep cannot see PHI clinical detail |
| Export: CSV, PDF | Builder | Minimum-necessary PHI in exports |

**Deliverable:** Pilot-ready v1. All "Must" features functional.

## Phase 4 — Import + pilot (Weeks 6-8)

| Task | Owner | Notes |
|---|---|---|
| WellSky CSV import pipeline | Builder | Per CRM-09 field mapping |
| Import orgs + contacts from client | Builder + Client | Client exports CSV |
| Import historical referrals (6-12mo) | Builder | |
| Dual-run setup | Builder + Client | See CRM-09 dual-run protocol |
| User training (Clay + Sarah) | Builder | |
| 1 real referral processed end-to-end | Builder + Client | Smoke test |
| Bug fixes and feedback loop | Builder | Daily standup with client |

**Deliverable:** Client actively using CRM for new referrals. WellSky still used for clinical/billing.

## Phase 5 — Harden + cutover (Weeks 8-10)

| Task | Owner | Notes |
|---|---|---|
| Security review (pen-test-lite) | Compliance reviewer | |
| BAA paperwork finalized (if not already) | Admin | |
| Backup/DR drill | Builder | RDS snapshot restore test |
| Performance testing (100 concurrent referrals) | Builder | |
| Cutover criteria checklist (CRM-09) | Builder + Client | |
| Full cutover from WellSky BD/referral | Client | WellSky retained for clinical only |
| Claims platform scrubber hook live | Builder | Denial risk score on every new referral |

**Deliverable:** Client fully on CRM for referral/BD. WellSky for clinical + billing only.

## Post v1 — expansion roadmap (Months 3-6)

| Month | Module | Notes |
|---|---|---|
| 3-4 | Clinical documentation (OASIS-E, visit notes) | Begins the full WellSky replacement |
| 4-5 | Scheduling / clinician routing | |
| 5-6 | 837I submission (via claims platform + Stedi) | |
| 6 | SOC 2 Type 1 completion | |
| 6+ | Multi-agency onboarding (vertical SaaS mode) | If [CONFIRM] answer = resell to others |

## Parallel workstreams

The CRM build runs alongside the claims platform scrubber build:

```
Month 1:  ├── Claims: HIPAA landing zone + BAA chain ──┤
          ├── CRM: Phase 0-1 (plan + foundation) ──────┤

Month 2:  ├── Claims: Scrubber wedge live ─────────────┤
          ├── CRM: Phase 2-3 (referral core + BD) ─────┤

Month 3:  ├── Claims: 835 ERA ingestion + dashboard ───┤
          ├── CRM: Phase 4-5 (pilot + cutover) ────────┤
```

CRM and scrubber share infra (RDS, WorkOS, S3, Bedrock, Inngest) so Phase 1 foundation work is partially shared.
