# CRM-04 — Architecture

> The CRM shares the claims platform's infrastructure. This doc covers CRM-specific additions. For the full stack, see `Insurance Claims/REF/STRATEGY.md` § 6.

## Shared stack (already decided — do not change)

| Layer | Choice | BAA |
|---|---|---|
| Frontend | Next.js 15 App Router on Vercel Enterprise | Yes |
| Backend | Hono / Fastify on AWS ECS Fargate | Yes |
| Workflows | Inngest Enterprise | Yes |
| Database | AWS RDS Postgres + pgvector | Yes |
| Storage | S3 + SSE-KMS + VPC endpoints | Yes |
| LLM | Claude Sonnet 4.6 + Opus 4.6 via AWS Bedrock | Yes |
| Auth | WorkOS (SSO, MFA, audit, directory sync) | Yes |
| Observability | Datadog with PHI scrubbing | Yes |
| Billing | Stripe (no PHI in metadata) | n/a |

**Hard constraints from STRATEGY.md:**
- No Clerk (no BAA)
- No Supabase below Team tier (no BAA)
- No PHI through n8n Cloud — self-hosted n8n inside VPC for internal ops only
- No Change Healthcare (post-2024 breach)
- **All AWS resources in us-west-1 (N. California)** — client requires California data residency

## CRM-specific additions

### 1. Fax ingestion pipeline

```
[eFax/SRFax] → Email → [SES inbound] → [S3: raw fax PDF]
                                              ↓
                                     [Inngest: parse-fax]
                                              ↓
                                     [Bedrock Sonnet 4.6]
                                       extract fields
                                              ↓
                                     [Stedi 270/271]
                                       eligibility check
                                              ↓
                                     [RDS: crm.referrals]
                                       status = new
                                              ↓
                                     [Claims scrubber]
                                       denial risk score
```

- Faxes arrive via email (most eFax providers forward to email)
- SES receives, stores raw attachment in S3 (KMS-encrypted)
- Inngest durable function triggers Claude Sonnet on the PDF
- Extraction output → structured referral record
- Auto-calls Stedi for eligibility verification
- Optionally calls the claims scrubber for a pre-denial-risk score

### 2. Mobile PWA

- Same Next.js app, responsive design (not a separate native app)
- Service worker for offline visit logging (sync when back online)
- GPS capture for BD visit verification
- **[CONFIRM]** Do we need push notifications for new referrals to BD reps?

### 3. Real-time pipeline updates

- Postgres LISTEN/NOTIFY for pipeline status changes
- Next.js server-sent events (SSE) to update kanban board live
- Alternative: polling every 10s (simpler, acceptable for v1)
- **[CONFIRM]** Real-time necessary for v1, or can we poll?

### 4. Report generation

- Server-side rendering of reports via React PDF or Puppeteer
- PDF export with PHI-minimum display (initials + MRN, not full name unless authorized)
- Scheduled email reports via SES (encrypted links, not inline PHI)

## Deployment topology

```
┌─────────────────────── VPC ───────────────────────┐
│                                                    │
│  ┌──── Public subnet ────┐  ┌── Private subnet ──┐│
│  │ ALB (TLS termination) │  │ ECS Fargate tasks  ││
│  │ Vercel → ALB for API  │  │  - CRM API         ││
│  └───────────────────────┘  │  - Claims API      ││
│                              │  - Inngest worker  ││
│                              │  - n8n (self-host) ││
│                              └────────────────────┘│
│                              ┌── Data subnet ─────┐│
│                              │ RDS Postgres        ││
│                              │  - crm schema       ││
│                              │  - claims schema    ││
│                              │ ElastiCache (sess.) ││
│                              └────────────────────┘│
│                              ┌── Storage ─────────┐│
│                              │ S3 (KMS-encrypted) ││
│                              │  - /fax-inbox/      ││
│                              │  - /referral-docs/  ││
│                              │  - /claims-837/     ││
│                              │  - /audit-exports/  ││
│                              └────────────────────┘│
└────────────────────────────────────────────────────┘
         ↕                    ↕
    [Vercel Edge]      [Bedrock / Stedi / WorkOS]
    (Next.js SSR)       (external, BAA-signed)
```

## Key architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Same RDS cluster, separate schema | `crm.*` and `claims.*` | Shared tenant model, no cross-DB joins needed, single AWS BAA |
| Inngest over n8n for PHI workflows | Inngest Enterprise (BAA) | n8n Cloud has no BAA; self-hosted n8n OK for non-PHI ops |
| PWA over native mobile app | Responsive Next.js + service worker | Ship faster; BD reps use phones but don't need app-store distribution |
| WorkOS over Clerk | WorkOS | Only auth provider with BAA + directory sync + audit log |
| Vercel Enterprise over self-hosted Next.js | Vercel Enterprise | BAA available; faster iteration than self-hosting on ECS |
| Stedi over direct AEVS | Stedi 270/271 | Modern API; handles X12 wire format; BAA signed |
