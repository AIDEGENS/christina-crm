# Always-Load Context

> **Every Claude terminal working on this project must read this file.** Contains client details, stack, and hard constraints that cannot change.

## Project

**Medical CRM** — HIPAA-compliant home health + hospice referral platform. A module of the AI Claims Optimization Platform. Replacing WellSky's BD/referral layer first, full WellSky replacement is the endgame.

- **Client:** Same as Insurance Claims AI platform pilot. Single EIN. 2 WellSky modules (HH + Hospice).
- **Goal:** 2-3 week MVP demo, then 10-week full build.
- **Pricing:** $4,000/mo Enterprise tier.
- **Data residency:** California only → **us-west-1 (N. California)**.

## Related project files

| File | Purpose |
|---|---|
| `../REF/CRM-ANSWERS.md` | Locked discovery answers (2026-04-15) |
| `../REF/CRM-01-SCOPE.md` | Scope, in/out, non-goals |
| `../REF/CRM-03-DATA-MODEL.md` | Postgres schema (9 tables, RLS) |
| `../REF/CRM-04-ARCHITECTURE.md` | Stack, VPC topology, deployment |
| `../REF/CRM-05-FEATURE-SPEC-V1.md` | MoSCoW feature list |
| `../REF/CRM-06-REFERRAL-FLOW.md` | End-to-end referral lifecycle |
| `../REF/CRM-08-SECURITY-HIPAA.md` | PHI controls, RBAC, audit |
| `../REF/CRM-MVP-2WEEK.md` | MVP sprint plan |
| `../../Insurance Claims/REF/STRATEGY.md` | Claims platform strategy (parent) |
| `../../Insurance Claims/REF/BAA-CHECKLIST.md` | BAA tracker |

## Stack — LOCKED, do not change

| Layer | Choice | BAA |
|---|---|---|
| Frontend | Next.js 15 App Router on **Vercel Enterprise** | Yes |
| Backend | Hono on **AWS ECS Fargate** (us-west-1) | Yes (AWS BAA) |
| Database | **AWS RDS Postgres 16** + pgvector (us-west-1) | Yes |
| Storage | **S3 + SSE-KMS** (us-west-1, per-tenant KMS keys) | Yes |
| AI | **Bedrock** Claude Sonnet 4.6 + Opus 4.6 | Yes |
| Auth | **WorkOS** (SSO, MFA, directory sync, audit) | Yes |
| Workflows | **Inngest Enterprise** (deferred to post-MVP) | Yes |
| Observability | **Datadog** with PHI scrubbing | Yes |
| Billing | **Stripe** (no PHI in metadata) | n/a |

## Hard constraints — DO NOT violate

- **NO Clerk** — no BAA on any tier
- **NO Supabase** below Team tier — no BAA
- **NO Change Healthcare** — post-2024 breach
- **NO PHI through n8n Cloud** — self-hosted only for internal non-PHI ops
- **NO hand-rolled X12 parser** — use Stedi when that phase comes
- **NO standard/Pro Vercel** — Enterprise only for BAA
- **NO PHI in Stripe** — customer ID maps to internal tenant only
- **NO PHI in CI logs / error messages / notifications** — scrub everywhere
- **All AWS resources in us-west-1** — California data residency
- **All PHI columns encrypted at rest** — AES-256 via KMS
- **TLS 1.3 everywhere in transit**
- **6-year audit log retention** — HIPAA §164.316

## Repo layout (monorepo with claims platform)

```
monorepo/
├── apps/
│   ├── crm-web/              ← Next.js frontend
│   ├── crm-api/              ← Hono backend
│   ├── claims-web/           ← existing claims platform frontend
│   └── claims-api/           ← existing claims platform backend
├── packages/
│   ├── db/                   ← shared Postgres schema, migrations, RLS
│   ├── auth/                 ← WorkOS shared middleware
│   ├── ui/                   ← shared shadcn components
│   └── config/               ← shared TS/ESLint/Tailwind config
├── infra/                    ← Terraform/CDK for AWS (us-west-1)
└── turbo.json                ← Turborepo config
```

## Data model — schemas

- `crm.*` — CRM entities (tenants, users, referrals, orgs, contacts, notes, documents, bd_visits, audit_log)
- `claims.*` — claims platform entities (episodes, scrubber_results, denials, appeals)
- Shared `tenant_id` across both schemas — 2 tenants in MVP (HH + Hospice)

## Roles (WorkOS + app-level)

- `admin` — everything within tenant
- `intake` — referrals, pipeline, docs, notes, orgs, contacts
- `bd_rep` — orgs, contacts, BD visits, referral cards (NO full patient PHI)
- `viewer` — dashboard, reports (aggregated only)

## Vendor decisions for MVP

| Vendor | Use | Notes |
|---|---|---|
| Vercel Enterprise | Hosting | BAA required; dev env first |
| AWS (us-west-1) | Infra | RDS, ECS, S3, KMS, SES all in N. California |
| WorkOS | Auth | SSO, roles, directory sync |
| Datadog | Observability | PHI scrub in log pipeline |
| GitHub Enterprise | Source control | BAA on enterprise |
| Doppler or 1Password | Secrets | Never commit secrets |

## Notifications (MVP)

- Email: SES (covered by AWS BAA). Body = link only, NO PHI.
- SMS (post-MVP): Twilio (has BAA). Body = generic alert, NO PHI.

## Test / seed data conventions

- Patient display = **initials only** (e.g., "R.K., 82 M")
- Use fake MRNs (e.g., 48210, 48211 — not real Medicare numbers)
- 2 tenants: `tenant_hh` (Meridian Home Health), `tenant_hospice` (Meridian Hospice)
- Test users: `clay@` (admin), `sarah@` (intake), `mike@` (bd_rep)

## Commit discipline

- Branch per step: `step-0.1-repo-setup`, `step-0.2-aws-infra`, etc.
- PR title = step ID + summary
- PR body = acceptance criteria checklist
- Compliance reviewer agent must sign off on any PR that touches PHI, RLS, auth, or S3

## When in doubt

1. Check `../REF/CRM-04-ARCHITECTURE.md` for stack questions
2. Check `../REF/CRM-08-SECURITY-HIPAA.md` for compliance questions
3. Check `../../Insurance Claims/REF/BAA-CHECKLIST.md` for vendor questions
4. Update `STATUS.md` with the decision and reasoning
