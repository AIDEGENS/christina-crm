# AWS-only migration plan — kill Vercel + Datadog + Doppler

**Dated:** 2026-04-23
**Status:** planning → executing
**Goal:** Cheapest HIPAA-compliant stack. Single AWS BAA + free WorkOS BAA. Drop $20k+/yr Vercel Enterprise. Drop $100-500/mo Datadog. Drop $18/mo Doppler.

## Target cost

| Service | Role | Cost (light usage) |
|---|---|---|
| AWS ECS Fargate | Next.js + Hono API hosting | ~$15-40/mo |
| AWS RDS Postgres t4g.micro + KMS | DB | ~$16/mo |
| AWS Secrets Manager / SSM Parameter Store | secrets | ~$0-$4/mo |
| AWS CloudWatch Logs + X-Ray | logs + traces | ~$5-20/mo |
| AWS CloudWatch RUM | frontend telemetry (deferred) | ~$1/10k sessions |
| AWS S3 + SSE-KMS | document storage | ~$0.50/mo |
| AWS SES | transactional email | $0.10/1k emails |
| CloudFront | CDN / edge | ~$1-5/mo |
| ALB | load balancer | ~$18/mo |
| WorkOS AuthKit | SSO / identity | $0 free tier |

**Total floor: ~$60-100/mo. Two BAAs (AWS Artifact click-sign + WorkOS email request). Both free.**

## Scope

### Drop entirely
- **Vercel** — no BAA on Pro/Hobby. Enterprise too expensive. Replace with ECS Fargate + CloudFront + ALB.
- **Datadog** — replace APM with AWS X-Ray, logs with CloudWatch Logs, RUM with CloudWatch RUM (deferred).
- **Doppler** — replace with AWS SSM Parameter Store (SecureString, KMS-encrypted). Secrets Manager for high-rotation items only.

### Keep
- **WorkOS AuthKit** — free tier, BAA on request. Existing `jose` JWKS verify + iron-session stays.
- **AWS KMS/RDS/S3** — already scaffolded via terraform modules.
- **pgcrypto envelope encryption** — Phase 1 TODO, unchanged.

## Migration phases

### Phase A — Code strip (this cycle, ~6 hours)

**A.1 — Observability swap (dd-trace → X-Ray, drop Datadog RUM)**
- Files: `apps/api/src/tracer.ts`, `apps/web/app/DatadogRumInit.tsx`, `apps/web/app/layout.tsx`, `packages/observability/src/{tracer,index}.ts`, `packages/observability/package.json`
- Replace `dd-trace` import + `tracer.init()` with `aws-xray-sdk-core` + `captureHTTPsGlobal(require('https'))` + `capturePostgres(require('pg'))`.
- Drop `DatadogRumInit.tsx` entirely OR stub to no-op (recommend delete, reinstate via CloudWatch RUM Phase 1).
- `packages/observability` retains scrubber + logger + metrics (all vendor-agnostic). Tracer becomes AWS-specific.
- Logger: pino JSON to stdout. CloudWatch Logs auto-ingests from ECS task def awslogs driver. Zero SDK change.
- Metrics: swap Datadog StatsD → CloudWatch EMF (Embedded Metric Format). Write structured JSON to stdout, CloudWatch extracts. `@aws-sdk/client-cloudwatch` NOT needed for EMF path.

**A.2 — Secrets swap (Doppler → SSM)**
- Files: `.env.example`, `scripts/doppler-setup.sh` → `scripts/ssm-setup.sh`, `.github/workflows/{ci.yml,deploy.yml}`, `docs/SECRETS.md`, `docs/SECRETS-HANDOFF.md`
- Delete `dopplerhq/cli-action@v3` wrapper from both workflows.
- Add boot loader: `packages/config/src/secrets.ts` using `@aws-sdk/client-ssm` `GetParametersByPath` with `/medical-crm/${NODE_ENV}/` prefix, decrypt in one round trip.
- Local dev: `.env` files stay. Production: IAM role on ECS task lets app self-fetch SSM at boot. Zero static secrets in env vars.
- `scripts/ssm-setup.sh` populates params from `.env.example` keys, prompts for values interactively.

**A.3 — Hosting swap (Vercel → ECS Fargate)**
- Files: delete `vercel.json`, `.vercelignore`, `apps/web/next.config.ts` standalone flag stays.
- Add `apps/web/Dockerfile` (multi-stage, Node 20 alpine, `output: 'standalone'` build).
- Add `apps/api/Dockerfile` (same pattern).
- Add `infra/terraform/modules/ecs/` — cluster, 2 services (web, api), task defs, awslogs driver.
- Add `infra/terraform/modules/alb/` — 1 ALB, 2 target groups, host-based routing (app.domain / api.domain).
- Add `infra/terraform/modules/cloudfront/` — CDN in front of ALB for web service.
- Add `infra/terraform/modules/ssm/` — parameter hierarchy + IAM read policy.
- Update `.github/workflows/deploy.yml` — build + push to ECR, update task def, force new deployment.

**A.4 — CSP + security header move**
- Vercel headers were in `vercel.json`. Already also in Next `middleware.ts` (per-request nonce CSP). ALB can add baseline headers via response header rules but keep Next middleware as authoritative — no code change needed here.
- HSTS preload already dropped. Re-add via CloudFront response headers policy when domain finalized.

**A.5 — Smoke + docs**
- Update `Plans/phase-0-foundation/STATUS.md` — mark 0.5/0.6/0.7 as superseded by AWS-only.
- Rename 0.5-vercel-deploy.md → 0.5-ecs-deploy.md. Same for 0.6 Datadog → CloudWatch, 0.7 Doppler → SSM.
- `docs/SECRETS.md` rewrite for SSM.
- `docs/DEPLOYMENT.md` (new) — ECS deploy runbook.

### Phase B — Infra apply (user-gated, post-commit)

1. Sign AWS BAA in AWS Artifact (click-sign, free).
2. Email WorkOS support for BAA (free, ~3 day turnaround).
3. Run `infra/terraform/bootstrap-state.sh` — creates S3 state bucket + DynamoDB lock table.
4. Configure GitHub OIDC ARN for `arn:aws:iam::ACCOUNT:role/gha-deploy`.
5. `tf-apply.sh dev` — provisions KMS, RDS, S3, SSM params, ECS cluster, ALB, CloudFront, ECR repos.
6. Populate SSM params via `scripts/ssm-setup.sh dev`.
7. First deploy: `gh workflow run deploy.yml -f env=dev`.
8. DNS: CloudFront distribution → `app.dev.domain`, ALB → `api.dev.domain` via Route53.

### Phase C — Verification

- Auth flow: sign-in → WorkOS callback → dashboard → sign-out
- PHI scrubber: log a synthetic PHI payload → verify redaction in CloudWatch Logs
- RLS: curl API as tenant A, assert cannot see tenant B rows
- X-Ray trace: verify spans arrive, query params stripped
- CSP: page loads, no CSP violations in browser console
- HSTS: `curl -I https://app.dev.domain` → `strict-transport-security` present (post-preload re-add)

## Code delta summary

| Package | Files added | Files modified | Files deleted |
|---|---|---|---|
| `apps/api` | `Dockerfile` | `src/tracer.ts`, `package.json` | — |
| `apps/web` | `Dockerfile` | `app/layout.tsx`, `package.json`, `next.config.ts` | `app/DatadogRumInit.tsx` |
| `packages/observability` | — | `src/{tracer,index}.ts`, `src/metrics.ts`, `package.json`, `README.md` | — |
| `packages/config` | `src/secrets.ts` | `package.json` | — |
| `infra/terraform/modules/` | `ecs/`, `alb/`, `cloudfront/`, `ssm/` | — | — |
| root | `docs/DEPLOYMENT.md` | `.env.example`, `.github/workflows/{ci,deploy}.yml`, `docs/SECRETS.md`, `docs/SECRETS-HANDOFF.md` | `vercel.json`, `.vercelignore` |
| `scripts` | `ssm-setup.sh` | — | `doppler-setup.sh` |
| `Plans/phase-0-foundation` | `AWS-ONLY-MIGRATION.md` (this doc) | `STATUS.md`, `0.5/0.6/0.7 plans` | — |

## Rollback

Every Phase A commit is reversible. Vercel/Datadog/Doppler accounts never created = nothing to tear down. Terraform state means Phase B apply is `tf-destroy.sh dev` away from zero. ECR images cost ~$0.10/GB/mo to keep; purge on rollback.

## Open decisions

1. **Frontend RUM**: drop entirely Phase 0 vs wire CloudWatch RUM now (~2 hr). **Recommend drop**, revisit at pilot signing.
2. **ECS vs App Runner**: Fargate gives control, App Runner is simpler but less flexible. **Recommend Fargate** — already have VPC + ALB need.
3. **SSM vs Secrets Manager**: SSM SecureString = free up to 10k params. Secrets Manager = $0.40/secret/mo + rotation automation. **Recommend SSM** for everything non-rotating, Secrets Manager only for DB master password (rotation required).
4. **Local dev secrets**: `.env` file stays (gitignored). No SSM in local loop. `packages/config/src/secrets.ts` detects `NODE_ENV !== 'production'` and falls through to `process.env`.

## Risk register

| Risk | Mitigation |
|---|---|
| AWS X-Ray less polished than Datadog APM | Acceptable Phase 0. Re-evaluate at pilot traction. |
| CloudWatch Logs query UX slower than Datadog | Mitigate with structured JSON (pino) + CloudWatch Insights saved queries. |
| ECS cold-start on low traffic | Keep `desired_count=1` minimum per service. Auto-scale 1→N on CPU. |
| Doppler → SSM boot latency | `GetParametersByPath` one call, ~50ms. Cache in-memory for process lifetime. |
| Vercel preview deploys lost | Swap: PR-triggered ephemeral ECS service via GHA. Deferred Phase 1. |
| CloudFront cert provisioning delay | Pre-provision ACM cert in us-east-1 (CloudFront requirement). |

## Gate to execute

- User decision: execute Phase A now? (code strip, ~6 hr executor work, no cloud spend yet)
- User decision: defer Phase B until pilot signed? (recommend yes)
