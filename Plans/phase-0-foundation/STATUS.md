# Phase 0 — Foundation Status

Last updated: 2026-04-23 (AWS-only migration — Phase A applied)

## Progress: 7 / 7 steps scaffolded

| Step | Title                                | Status       | Notes                                                              |
|------|--------------------------------------|--------------|--------------------------------------------------------------------|
| 0.1  | Repo setup                           | DONE         | Monorepo, pnpm, Turborepo, CI skeleton all live                    |
| 0.2  | AWS infra (RDS + S3 + KMS)           | SCAFFOLD     | Terraform + bootstrap scripts written; USER-BLOCKED on AWS account |
| 0.3  | Postgres schema + RLS                | DONE         | drizzle schema, migrations, RLS policies, seed all committed       |
| 0.4  | WorkOS auth                          | SCAFFOLD     | Auth package + session wired; USER-BLOCKED on WorkOS project + BAA |
| 0.5  | ECS Fargate deploy                   | SCAFFOLD     | Dockerfiles + deploy workflow; USER-BLOCKED on AWS BAA + terraform apply. *Superseded Vercel approach — see `AWS-ONLY-MIGRATION.md`* |
| 0.6  | CloudWatch + X-Ray observability     | SCAFFOLD     | X-Ray tracer + EMF metrics + pino logger; USER-BLOCKED on account + log groups. *Superseded Datadog approach — see `AWS-ONLY-MIGRATION.md`* |
| 0.7  | Secrets management (SSM)             | SCAFFOLD     | `packages/config/src/secrets.ts`, `scripts/ssm-setup.sh`, workflows updated. USER-BLOCKED on KMS key + SSM hierarchy. *Superseded Doppler approach — see `AWS-ONLY-MIGRATION.md`* |

## Legend

| Marker       | Meaning                                                      |
|--------------|--------------------------------------------------------------|
| DONE         | Fully implemented and verified end-to-end                    |
| SCAFFOLD     | Code/config written; blocked on external accounts or infra   |
| USER-BLOCKED | Requires manual action from the project owner                |
| PENDING      | Not yet started                                              |

## AWS-only migration (2026-04-23)

Phase A (code strip) complete:
- Vercel config deleted (`vercel.json`, `.vercelignore`).
- Datadog code removed (`DatadogRumInit.tsx`, `@datadog/*` deps).
- Doppler script + workflow wrappers deleted.
- X-Ray tracer replaces dd-trace (`packages/observability/src/tracer.ts`).
- CloudWatch EMF replaces Datadog StatsD (`packages/observability/src/metrics.ts`).
- SSM loader added (`packages/config/src/secrets.ts`) + bootstrap integration (`apps/api/src/bootstrap.ts`).
- Dockerfiles for web + api + repo-root `.dockerignore`.
- Deploy workflow rewritten for ECR push + ECS deploy + OIDC.

Phase B (cloud provisioning) remains user-gated — see `AWS-ONLY-MIGRATION.md` § Phase B.

## User-blocked items (Phase 0)

The following require Clay's action before Phase 0 can be declared complete:

1. **AWS account + BAA** — sign BAA in AWS Artifact (free, click-sign). Create IAM Identity Center, `gha-deploy` OIDC role, `crm-app` role. (0.2 / 0.5 / 0.6 / 0.7)
2. **WorkOS** — Create WorkOS project, register SSO org, email WorkOS for BAA, obtain API keys (0.4)
3. **Terraform apply** — run bootstrap-state.sh, then `tf-apply.sh dev` to provision KMS + RDS + S3 + SSM + ECS + ALB + CloudFront + ECR. (0.2 / 0.5 / 0.7)
4. **Populate SSM** — `./scripts/ssm-setup.sh dev` after terraform apply. (0.7) See `docs/SECRETS-HANDOFF.md`.
5. **First ECS deploy** — `gh workflow run deploy.yml -f env=dev`. (0.5)
6. **Route53 + ACM** — app.dev.domain → CloudFront, api.dev.domain → ALB. (0.5)

## Exit criteria

See `PHASE-0-EXIT.md` for the full verification runbook that must pass before Phase 1.
