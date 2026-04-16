# CRM-12 — Agent Team Build Plan

> How to use `/agent-team-build-loop`, subagents, and skills to build the CRM efficiently. Maps to the 3-role Agent Team methodology from the existing skill.

## Build methodology

Fork `/agent-team-build-loop` as `/crm-build-loop`. Same 3-role structure, adapted for HIPAA:

### Role 1 — Architect
- Owns: schema migrations, API contracts, RLS policies, Inngest workflow definitions
- Reviews: every PR that touches data model or auth
- Skills: `senior-architect`, `database-design`, `postgres-best-practices`, `api-design-principles`, `saas-multi-tenant`

### Role 2 — Builder
- Owns: Next.js pages/components, API routes, Bedrock prompts, Stedi integration, UI
- Builds features per CRM-05 feature spec, in priority order
- Skills: `react-nextjs-development`, `shadcn`, `tailwind-design-system`, `nextjs-best-practices`, `drizzle-orm-expert` or `prisma-expert`, `hono`

### Role 3 — Compliance Reviewer
- Reviews: every PR before merge through HIPAA lens
- Checks: PHI exposure, audit log coverage, RLS bypass risks, prompt injection in Bedrock calls, S3 access patterns
- Skills: `security-auditor`, `privacy-by-design`, `threat-modeling-expert`, `auth-implementation-patterns`

### Validator (automated, not a human role)
- Runs: TypeScript type check, ESLint, unit tests, E2E tests (Playwright), SAST scan
- Gate: PR cannot merge unless validator passes
- Skills: `playwright-skill`, `e2e-testing`, `test-driven-development`

## Build order (maps to CRM-10 roadmap)

### Sprint 0 (Phase 1, Week 1)
**Architect leads; Builder follows**

1. Scaffold monorepo or repo structure
2. Define Postgres schema DDL (`crm` schema, all tables from CRM-03)
3. Apply RLS policies
4. WorkOS integration (auth middleware)
5. S3 bucket + KMS config (Terraform or CDK)
6. Audit log middleware (intercepts all API routes)
7. CI/CD pipeline (GitHub Actions → Vercel + ECS)

**Architect deliverable:** Schema + RLS + auth middleware merged and tested.
**Builder deliverable:** Next.js app skeleton deployed to Vercel dev. Login works.

### Sprint 1 (Phase 2, Weeks 2-3)
**Builder leads; Architect reviews**

1. Referral CRUD API + UI
2. Pipeline kanban (React component, server actions for status update)
3. Referral detail page (3-column layout from mockup)
4. Organization CRUD + list/scorecard
5. Contact CRUD + NPPES lookup

**Subagent tasks (parallel):**
- Explore agent: research Bedrock PDF extraction prompt patterns for medical referrals
- Explore agent: research Stedi 270/271 request/response format for Medicare Part A

### Sprint 2 (Phase 2, Weeks 3-4)
**Builder leads; Compliance Reviewer active**

1. Fax intake pipeline (SES → S3 → Inngest → Bedrock → referral)
2. Bedrock extraction prompt (iterate with real fax samples)
3. Stedi eligibility integration
4. Claims scrubber hook (internal API call for denial risk)
5. Search implementation (pg_trgm or full-text)

**Compliance Reviewer checks:**
- Bedrock prompts don't leak PHI into logs
- S3 presigned URLs expire correctly
- Stedi API keys rotated and stored in Secrets Manager
- Fax PDF access logged in audit trail

### Sprint 3 (Phase 3, Weeks 4-5)
**Builder leads**

1. Dashboard (KPI tiles, velocity chart, source bars, activity feed)
2. BD visit logging (desktop)
3. Mobile PWA (responsive + service worker + GPS)
4. Email notifications (SES)
5. Role-based access enforcement (bd_rep cannot see full PHI)

### Sprint 4 (Phase 3-4, Weeks 5-7)
**Builder + Architect**

1. Reports (velocity, scorecard, payer mix, SLA, lost reasons)
2. Export (CSV, PDF with PHI-minimum)
3. Settings page (agency info, users, roles, compliance dashboard)
4. Tenant switcher (top nav dropdown)
5. WellSky import pipeline (CRM-09)

### Sprint 5 (Phase 5, Weeks 7-10)
**All roles**

1. Import client's real data
2. Dual-run support
3. Security review
4. Performance testing
5. Backup/DR drill
6. Cutover

## Skills to use per phase

| Phase | Skills |
|---|---|
| Foundation | `senior-architect`, `database-design`, `saas-multi-tenant`, `postgres-best-practices`, `auth-implementation-patterns`, `secrets-management` |
| Referral core | `react-nextjs-development`, `shadcn`, `nextjs-best-practices`, `api-design-principles`, `hono` |
| AI extraction | `claude-api`, `prompt-engineering`, `llm-structured-output` |
| Integrations | `stripe-integration`, `sendgrid-automation`, `twilio-communications` |
| Testing | `playwright-skill`, `e2e-testing`, `test-driven-development` |
| Security | `security-auditor`, `threat-modeling-expert`, `privacy-by-design` |
| Diagrams | `excalidraw-diagram`, `mermaid-expert` |
| Deployment | `deployment-engineer`, `docker-expert`, `terraform-specialist` |

## MCPs to configure

| MCP | Purpose | Priority |
|---|---|---|
| n8n-cloud | Non-PHI automation (marketing, onboarding flows) | Already active |
| n8n-mcp | Node/workflow reference | Already active |
| GitHub MCP | Repo ops, PRs, issues | P0 |
| Supabase MCP (if Neon used) | DB ops | P1 |
| Playwright MCP | E2E testing | P1 |
| Stripe MCP | Subscription billing | P2 |
| AWS MCP | Infra ops | P2 |

## Parallel agent strategy

During build, use Agent Teams for independent workstreams:

```
Main thread (Clay)
    │
    ├── Agent Team A: Foundation (Sprint 0)
    │     ├── Architect agent: schema + RLS + auth
    │     └── Builder agent: Next.js scaffold + CI/CD
    │
    ├── Agent Team B: Referral core (Sprint 1-2)
    │     ├── Builder agent: CRUD + pipeline UI
    │     ├── AI agent: Bedrock prompt engineering
    │     └── Integration agent: Stedi + NPPES
    │
    └── Agent Team C: Polish + migrate (Sprint 3-5)
          ├── Builder agent: dashboard + mobile + reports
          ├── Compliance agent: security review + audit
          └── Migration agent: WellSky import + dual-run
```

Each team runs in parallel when independent; serialized when there are data/schema dependencies between them.
