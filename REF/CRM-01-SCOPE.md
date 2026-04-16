# CRM-01 — Scope & Decisions

## What we're building

A **HIPAA-compliant referral intake + BD tracking + pipeline CRM** for home health and hospice agencies. This is the front-of-funnel layer that connects to the AI Claims Optimization Platform (scrubber + denial recovery). Together they form a full WellSky replacement.

### In scope (v1 — "Starter CRM")

1. **Referral intake** — AI-parsed fax/email/e-referral ingestion (Claude via Bedrock)
2. **Pipeline** — kanban board: New → Eligibility → SOC Scheduled → Admitted → Lost
3. **Eligibility verification** — automated Stedi 270/271 calls on intake
4. **Organization management** — hospitals, SNFs, physician practices with referral scorecards
5. **Contact directory** — physicians, case managers, discharge planners
6. **BD rep tracking** — visit logging, route planning, activity scorecards
7. **Dashboard & reports** — referral velocity, conversion, payer mix, source scorecards
8. **Mobile field app** — responsive PWA for BD reps at hospitals/SNFs
9. **Multi-tenant** — row-level security from day 1, agency switcher in UI
10. **Audit log** — every PHI access logged, 6-year retention

### Out of scope (v1)

- Clinical documentation (OASIS-E, HIS, visit notes) — stays in WellSky during v1
- Billing / RCM / 837I submission — handled by claims platform scrubber, not CRM
- eMAR / medication management
- Scheduling / routing clinicians
- HR / payroll
- Custom ML model training — Bedrock prompt-based extraction is sufficient for v1
- Real HL7 FHIR integration — CSV/SFTP ingest from WellSky is the v1 path

### How it connects to the claims platform

```
[CRM: Referral intake]  →  [Claims platform: Pre-submission scrubber]
       ↓                              ↓
[CRM: Pipeline mgmt]     [Claims platform: 837I via Stedi]
       ↓                              ↓
[CRM: Reports]           [Claims platform: 835 denial recovery]
```

Shared infrastructure: AWS RDS (same Postgres cluster, separate schemas), WorkOS auth (same tenant model), Bedrock (same AWS BAA), S3 (same bucket hierarchy, separate prefixes).

## Answers — Locked 2026-04-15

1. **Same client and EIN** as claims scrubber. Shared BAA chain, shared infra.
2. **2 WellSky modules (HH + Hospice)** — not seats, not locations. Need 2 tenants in our CRM.
3. **GHL: not sure yet.** Document boundary but don't integrate. GHL has NO BAA — non-PHI only if used.
4. **Client likes:** end-to-end workflow, compliance focus, data/analytics, scales well, strong in post-acute. These are our feature floor.
5. **Client hates:** steep learning curve, outdated UI, slow support, expensive, rigid customization. These are our wedge.
6. **Word of mouth is primary referral channel.** BD rep relationships, not fax. AI fax parsing deferred to post-MVP.
7. **Start with one client, scale if it works.** Multi-tenant from day 1 but no self-serve onboarding yet.
8. **$4,000/mo Enterprise tier.** Prices subject to change.
9. **2-3 week MVP demo.** See `CRM-MVP-2WEEK.md` for scoped sprint plan.
10. **Yes, WellSky stays for clinical/billing.** CRM replaces BD/referral layer first. Full replacement is the endgame.

## Non-goals

- This is NOT an EHR replacement in v1. The CRM handles referral-to-admission; clinical episodes stay in WellSky until we build that module (months 3-6 post-CRM).
- This is NOT a generic CRM. It is purpose-built for HH/hospice referral workflows and will not accommodate non-healthcare use cases.
- No real-time bidirectional sync with WellSky in v1 — one-way import (WellSky → CRM) via CSV/SFTP.
