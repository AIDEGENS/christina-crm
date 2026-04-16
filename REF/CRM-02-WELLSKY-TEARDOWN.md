# CRM-02 — WellSky Competitive Teardown

> What to take, what to beat, what to skip. Based on KLAS reviews, user complaints, and industry analysis. Validated against the mockup UI (see `hh-crm-mockup.html`).

## What WellSky does well (our feature floor)

These are table stakes. If we don't match them, the client won't switch:

1. **OASIS scrubbing integration** — WellSky validates OASIS-E fields inline during clinical documentation. We defer this to v2, but the CRM must accept OASIS data from WellSky imports for denial-risk scoring.
2. **Episode tracking** — 60-day home health episodes with PDGM case-mix visibility. Our pipeline tracks episodes from referral-to-admission; post-admission tracking is phase 2.
3. **Basic reporting** — canned reports on referral volume, payer mix, episodes by status. We must match and exceed with real-time dashboards.
4. **Multi-payer billing** — WellSky handles Medicare, Medi-Cal, and MA plans. The claims scrubber handles this; CRM surfaces eligibility status.
5. **Regulatory compliance posture** — WellSky is SOC 2 and HIPAA-compliant. We must match from day 1.

## Where WellSky falls short (our wedge)

These are the gaps we exploit:

| Gap | WellSky reality | Our answer |
|---|---|---|
| **Referral intake speed** | Manual data entry from faxes; intake coordinator types everything | AI-parsed fax/email extraction via Bedrock — 10-second parse, one-click accept |
| **Eligibility automation** | Eligibility check is a separate screen, often manual | Auto Stedi 270/271 on intake; result on the referral card |
| **PlayMaker ↔ EHR handoff** | PlayMaker CRM and WellSky EHR are same company but poorly integrated; BD rep data doesn't flow to intake cleanly | Single system: BD rep logs visit → org scorecard → referral arrives → same pipeline |
| **Reporting flexibility** | Canned reports only; custom reports require consultants or external BI | Real-time dashboards + custom report builder + CSV/PDF export |
| **Mobile BD app** | WellSky mobile is clinician-focused (visit notes); PlayMaker mobile is dated | Purpose-built mobile PWA for BD reps: route planning, org scorecards, one-tap visit logging |
| **API / integration** | APIs gated and expensive; partnership agreements required | Open architecture; n8n/Inngest webhooks for automation; REST API for everything |
| **Performance** | Slow at scale; sync lag during peak documentation hours | Modern Next.js frontend, edge-cached, Postgres with proper indexing |
| **UI/UX** | Frankenstein UI from acquisitions; 2010s design; too many clicks per task | Clean, purpose-built interface (see mockup) |
| **Pricing** | $8k/mo for 2 accounts; 10-20% annual increases; multi-year lock-in | Founding-customer rate ~$2.4k/mo; unlimited seats; no annual hikes in year 1 |
| **Support quality** | Degraded post-consolidation; long ticket queues; tier-1 can't resolve | Direct line to build team during pilot; dedicated Slack channel |
| **SLA breach visibility** | Referral SLA breaches buried 3 clicks deep | Dashboard alerts, color-coded cards, push notifications |
| **Denial prevention** | WellSky has basic claim edits; no predictive denial scoring | AI scrubber integration: every referral gets a denial-risk score at intake |

## What to skip (not in v1, maybe never)

- **OASIS-E clinical documentation** — massive clinical surface area; defer to v2+
- **eMAR** — medication administration is a liability mine; don't touch it
- **Scheduling/routing** — clinician scheduling is a different product (MatrixCare Kinnser does this)
- **HR/payroll integration** — nice to have, never a switching driver
- **Custom HL7 FHIR** — WellSky barely has it themselves; CSV/SFTP is realistic

## PlayMaker CRM — the specific competitor

PlayMaker is WellSky's BD CRM product. It's the closest direct competitor to what we're building:

| PlayMaker feature | Our equivalent | Advantage |
|---|---|---|
| BD visit logging | Visit log with GPS + org scorecard | Richer data, better mobile |
| Referral source tracking | Organization entity with 30d/conversion/owner | Real-time, not nightly batch |
| Territory management | Multi-tenant agency isolation | Simpler, more flexible |
| Physician directory | Contact entity with NPI lookup (NPPES) | Auto-enriched from NPPES |
| Competitive intel | Organization notes + lost-reason analysis | Integrated, not bolted on |
| PlayMaker ↔ WellSky integration | N/A (we are the EHR) | No integration gap — single system |

## Axxess and HCHB — secondary competitors

- **Axxess** — shipping ambient scribing and predictive tools faster than WellSky; stronger mobile; but weaker BD/sales CRM layer. If the client ever evaluates Axxess, our scrubber + CRM combo still wins on the BD side.
- **HCHB (Homecare Homebase)** — enterprise-focused (large agencies); expensive; strong operations but weak referral tracking. Our target is mid-market agencies being overcharged by WellSky.
