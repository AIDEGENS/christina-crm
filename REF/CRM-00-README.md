# Medical CRM — Home Health & Hospice Referral Platform

> The CRM module for the AI Claims Optimization Platform. Replaces WellSky's BD/referral/intake layer at a fraction of $8k/mo. The scrubber (see `Insurance Claims/REF/STRATEGY.md`) is the wedge; the CRM is the expansion that makes switching cost high.

---

## Quick start — read in this order

| # | File | What it covers |
|---|---|---|
| 01 | [CRM-01-SCOPE.md](CRM-01-SCOPE.md) | What's in, what's out, key assumptions, open questions |
| 02 | [CRM-02-WELLSKY-TEARDOWN.md](CRM-02-WELLSKY-TEARDOWN.md) | What to take from WellSky/PlayMaker, what to leave |
| 03 | [CRM-03-DATA-MODEL.md](CRM-03-DATA-MODEL.md) | Entities, fields, relationships, RLS strategy |
| 04 | [CRM-04-ARCHITECTURE.md](CRM-04-ARCHITECTURE.md) | Stack (shared with claims platform), CRM-specific additions |
| 05 | [CRM-05-FEATURE-SPEC-V1.md](CRM-05-FEATURE-SPEC-V1.md) | MoSCoW feature list with acceptance criteria |
| 06 | [CRM-06-REFERRAL-FLOW.md](CRM-06-REFERRAL-FLOW.md) | Fax/email/portal intake → pipeline → admission |
| 07 | [CRM-07-INTEGRATIONS.md](CRM-07-INTEGRATIONS.md) | eFax, Stedi eligibility, GHL, QB, notifications |
| 08 | [CRM-08-SECURITY-HIPAA.md](CRM-08-SECURITY-HIPAA.md) | CRM-specific PHI controls (defers to claims-platform BAA docs) |
| 09 | [CRM-09-MIGRATION-FROM-WELLSKY.md](CRM-09-MIGRATION-FROM-WELLSKY.md) | Data extraction, dual-run, cutover plan |
| 10 | [CRM-10-ROADMAP.md](CRM-10-ROADMAP.md) | 10-week build mapped to platform 6-month roadmap |
| 11 | [CRM-11-PRICING.md](CRM-11-PRICING.md) | Commercial model — undercut WellSky, lock founders |
| 12 | [CRM-12-AGENT-TEAM-PLAN.md](CRM-12-AGENT-TEAM-PLAN.md) | Which subagents build what, in what order |

## Related artifacts

| File | Location |
|---|---|
| `hh-crm-mockup.html` | This folder + Desktop — interactive clickable prototype |
| `hh-crm-system-architecture.excalidraw` | This folder — CRM architecture overlay |
| `claims-platform-architecture.excalidraw` | `Insurance Claims/REF/` — parent platform arch |
| `STRATEGY.md` | `Insurance Claims/REF/` — platform strategy + stack |
| `BAA-CHECKLIST.md` | `Insurance Claims/REF/` — vendor BAA tracker |
| `API-INVENTORY.md` | `Insurance Claims/REF/` — every external API |
| `REGULATIONS.md` | `Insurance Claims/REF/` — CFR sections, compliance |

## Discovery answers locked (2026-04-15)

All 20 questions answered — see [CRM-ANSWERS.md](CRM-ANSWERS.md). Key decisions:
- Same client/EIN as claims scrubber. 2 WellSky modules (HH + Hospice) = 2 tenants.
- **2-3 week MVP demo** — see [CRM-MVP-2WEEK.md](CRM-MVP-2WEEK.md) for sprint plan.
- Word of mouth is primary referral channel — AI fax parsing deferred to post-MVP.
- $4,000/mo Enterprise tier. California data residency (us-west-1).
- QuickBooks + Twilio SMS in v1. GHL status TBD. PWA now, native later. Monorepo.
