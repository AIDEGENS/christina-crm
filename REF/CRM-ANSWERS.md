# Discovery Answers — Locked 2026-04-15

> All 20 questions answered. These are now the source of truth for spec decisions.

## Scope & client

| # | Question | Answer |
|---|---|---|
| 1 | Same pilot client as claims scrubber? | **Yes, same client and EIN.** Shared BAA chain, shared infra. |
| 2 | "2 accounts at $8k" meaning? | **2 WellSky modules (Home Health + Hospice).** Not seats, not locations. |
| 3 | Replace all or just BD layer? | **Start with BD/referral layer, but context is turning the full system over to us.** Phased replacement confirmed. |
| 4 | One-client or vertical SaaS? | **Start with one, scale if it works.** Build multi-tenant from day 1 but don't invest in self-serve onboarding yet. |

## WellSky intelligence

| # | Question | Answer |
|---|---|---|
| 5 | What client likes | 1. Strong in post-acute/HH — built for their vertical. 2. End-to-end workflow (intake, scheduling, billing, compliance, reporting). 3. Compliance-focused (Medicare/Medicaid, documentation, audit risk). 4. Data & analytics (outcomes, productivity, financial). 5. Scales well for large/multi-location orgs. |
| 6 | What client hates | 1. **Steep learning curve** — not intuitive, slow onboarding. 2. **Outdated UI** — clunky, slow navigation. 3. **Slow customer support** — tickets take too long. 4. **Expensive** — licensing + add-ons + implementation fees. 5. **Rigid customization** — have to adapt to the software, not the other way around. |
| 7 | CSV export available? | **Yes.** Migration path confirmed. |

## Referral operations

| # | Question | Answer |
|---|---|---|
| 8 | How referrals come in? | **Word of mouth for the most part.** NOT fax-heavy. BD rep relationships are the primary channel. AI fax parsing is less urgent for this client — manual entry + BD workflow comes first. |
| 9 | Who touches first? | **BD rep.** They receive the referral from the source directly. |
| 10 | eFax provider? | **Not sure.** May not even have one if word of mouth is primary. |

## Commercial

| # | Question | Answer |
|---|---|---|
| 11 | Target MRR? | **$4,000/mo Enterprise tier.** Prices subject to change. Full suite including denial recovery. |
| 12 | Pilot timeline? | **2-3 weeks for MVP demo.** This is a sprint. Full build is still 10 weeks. |
| 13 | Branding? | **TBD.** Don't commit to white-label or client brand yet. Use a neutral product name. |

## Integrations

| # | Question | Answer |
|---|---|---|
| 14 | GHL? | **Not sure yet.** Document the boundary but don't integrate. |
| 15 | SMS notifications? | **Yes, SMS + email.** Twilio (BAA) for SMS, SES for email. |
| 16 | QuickBooks? | **Yes, in v1.** QB Enterprise has BAA. Adds integration scope. |

## Compliance & hosting

| # | Question | Answer |
|---|---|---|
| 17 | SOC 2 timing? | **Month 6 as planned.** |
| 18 | Data residency? | **California only.** Use **us-west-1 (N. California)** instead of us-west-2 (Oregon). |

## Technical

| # | Question | Answer |
|---|---|---|
| 19 | Mobile? | **PWA now, native later.** |
| 20 | Repo structure? | **Monorepo with claims platform.** |

## Impact on plan

### Critical changes from discovery

1. **MVP scope must fit 2-3 weeks** — see `CRM-MVP-2WEEK.md` for scoped-down sprint plan
2. **Word of mouth referrals change intake priority** — AI fax parsing deferred to post-MVP; manual entry + BD rep workflow is the v1 focus
3. **$4k/mo Enterprise pricing** — higher than draft $2.4k Pro tier
4. **QuickBooks integration** — must plan for QB API (BAA on enterprise tier)
5. **us-west-1 (N. California)** — all AWS resources in this region for data residency
6. **Full WellSky replacement is the endgame** — v1 = BD/referral, v2 = clinical, v3 = billing
