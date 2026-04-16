# Phase 0 — Foundation

**Duration:** Days 1-2 of MVP sprint
**Goal:** Deploy an empty, authenticated, multi-tenant skeleton to dev. Client cannot see it yet, but everything downstream depends on this.

## Steps

| ID | Step | File |
|---|---|---|
| 0.1 | Repo setup (monorepo scaffold) | `0.1-repo-setup.md` |
| 0.2 | AWS infra (us-west-1) | `0.2-aws-infra.md` |
| 0.3 | Postgres schema + RLS | `0.3-postgres-schema.md` |
| 0.4 | WorkOS auth | `0.4-workos-auth.md` |
| 0.5 | Vercel deploy (dev) | `0.5-vercel-deploy.md` |
| 0.6 | Datadog observability + PHI scrubbing | `0.6-datadog-observability.md` |
| 0.7 | Secrets management (Doppler) | `0.7-secrets-management.md` |
| — | Phase 0 exit runbook | `PHASE-0-EXIT.md` |

## Parallel opportunities

After 0.1:
- **Track A:** 0.2 → 0.3 → 0.5 → 0.6
- **Track B:** 0.4 (parallel to 0.2/0.3)
- **0.7** runs last (needs real secrets from earlier steps to migrate)

## Exit criteria

Run `PHASE-0-EXIT.md` end-to-end. Do not proceed to Phase 1 unless every checkbox passes. Summary gates:

- [ ] Monorepo scaffolded with `apps/crm-web`, `apps/crm-api`, `packages/db`, `packages/auth`, `packages/ui`, `packages/observability`
- [ ] AWS VPC + RDS + S3 + KMS provisioned in us-west-1 via Terraform
- [ ] Postgres `crm` schema deployed with all 9 tables, RLS policies active + smoke-tested
- [ ] WorkOS SSO working with role-based middleware
- [ ] Vercel Enterprise dev deployment live with security headers
- [ ] Datadog APM + RUM + logs flowing, PHI scrubbing active, alerts configured
- [ ] All secrets in Doppler, Vercel UI env vars cleared
- [ ] Two test tenants seeded (Meridian HH + Meridian Hospice)
- [ ] Admin user (Clay) can log in and see empty dashboard
- [ ] All 6 Phase 0 BAAs signed (AWS, Vercel, WorkOS, Datadog, Doppler, GitHub)

## Do not start Phase 1 until PHASE-0-EXIT.md is fully green.
