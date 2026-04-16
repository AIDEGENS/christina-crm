# CRM-11 — Pricing & Commercial Model

> How to price the CRM + scrubber bundle to undercut WellSky ($8k/mo for 2 accounts) while protecting margin and avoiding Stark Law / Anti-Kickback issues.

## Pricing structure: SaaS subscription (NOT per-claim)

**Critical legal constraint:** Per-claim or per-recovered-dollar pricing can be construed as paying for referrals under the Anti-Kickback Statute (42 USC §1320a-7b). Healthcare counsel flagged this in STRATEGY.md. **Use a flat SaaS subscription model.**

## Proposed tiers

| Tier | Monthly | Seats | Includes | Target |
|---|---|---|---|---|
| **Starter** | $1,200/mo | Up to 5 users | CRM only (referral intake, pipeline, orgs, contacts, BD, reports, mobile) | Small agencies, 50-100 episodes |
| **Pro** | $2,400/mo | Up to 15 users | CRM + Scrubber (pre-submission validation, eligibility auto-check, denial risk scoring) | Mid-market agencies, 100-200 episodes |
| **Enterprise** | $4,000/mo | Unlimited | CRM + Scrubber + Denial Recovery (835 ERA auto-classify, appeal letter generation, resubmission) + dedicated support | Large agencies, 200+ episodes |

### Founding-customer rate

- **[CONFIRM]** pilot client gets Pro tier at $2,400/mo (or adjusted)
- Locked for 12 months from go-live date
- No annual price increases in year 1
- After year 1, increases capped at CPI or 5%, whichever is lower

## Cost comparison vs WellSky

| | WellSky | Our platform (Pro) |
|---|---|---|
| Monthly cost | $8,000 | $2,400 |
| Seats | 2 accounts | 15 users |
| Annual cost | $96,000 | $28,800 |
| **Savings** | — | **$67,200/year** |
| Annual increases | 10-20% | Capped at 5% |
| Contract length | Multi-year | Monthly or annual |
| Referral intake | Manual data entry | AI-parsed in 10 seconds |
| Eligibility check | Separate module, manual | Auto (Stedi) |
| Denial prevention | Basic edits | AI scrubber with risk scoring |
| BD mobile app | Dated PlayMaker app | Modern PWA |
| Support | Tier-1 queue | Direct line to build team |

**Key message: save $67k/year and get a better product.**

## Unit economics

### Cost to serve (per tenant per month)

| Item | Cost | Notes |
|---|---|---|
| AWS infra (RDS, ECS, S3, KMS) | ~$150-300 | Shared multi-tenant, amortized |
| Bedrock (extraction + scrubbing) | ~$50-150 | ~100 referrals × $0.05 + ~200 claims × $0.50 |
| Stedi (270/271 + 837I) | ~$30-100 | ~100 eligibility checks + claims |
| WorkOS | ~$10-50 | Per active user |
| Vercel Enterprise | ~$50-100 | Amortized |
| Datadog | ~$30-60 | Amortized |
| Inngest | ~$20-40 | Amortized |
| **Total COGS** | **~$340-800** | |

At Pro tier ($2,400/mo), gross margin is **67-86%**. Healthy for vertical SaaS.

## Revenue projections (if scaling to vertical SaaS)

| Year | Agencies | ARR | Notes |
|---|---|---|---|
| Y1 (pilot) | 1 | $28.8k | Founding customer, Pro tier |
| Y1 Q4 | 3-5 | $86-144k | Word of mouth in Sacramento market |
| Y2 | 10-15 | $288-432k | Expand to Noridian J-E region (CA) |
| Y3 | 30-50 | $864k-1.4M | Multi-MAC expansion |

**[CONFIRM]** Is this a one-client product or does Clay intend to scale this as vertical SaaS?

## Contract terms

- Month-to-month available (low risk for client to try)
- Annual prepay: 2 months free (10-month price for 12 months)
- 30-day written notice to cancel
- Data export: client can export all their data (CSV) at any time — this is a HIPAA right and a trust builder
- BAA signed before any PHI moves

## What's NOT included in base pricing

- Custom integrations (HL7 FHIR, specific EHR connectors): scoped and quoted separately
- White-label branding: $500/mo add-on
- Dedicated instance (single-tenant hosting): Enterprise tier + $1,000/mo
- Implementation/onboarding: included free for founding customer; $2,000 one-time for future customers
- Training: included for up to 5 users; additional training at $200/hr

## Anti-Kickback safe harbor

The pricing model is a **fixed SaaS subscription** for a technology platform. It does not:
- Charge per-referral
- Pay per-referral
- Charge per-recovered-dollar
- Include any volume-based discounts tied to referral volume
- Offer free services contingent on referral patterns

This fits within the **Personal Services and Management Contracts** safe harbor (42 CFR §1001.952(d)): fixed aggregate compensation, set in advance, consistent with fair market value, not determined by volume or value of referrals.

**[CONFIRM]** Have healthcare counsel review the contract template before signing the pilot.
