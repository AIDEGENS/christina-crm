# infra/ — Christina CRM AWS Infrastructure (Phase 0.2)

Terraform scaffold for the Christina CRM HIPAA-aligned AWS stack in **us-west-1**.
This directory is **scaffold only**. No `terraform apply` has been run.

## Layout

```
infra/
├── terraform/
│   ├── modules/       # reusable building blocks
│   │   ├── network/           VPC, subnets, IGW, NAT, flow logs
│   │   ├── database/          RDS Postgres 16, encrypted, backups
│   │   ├── secrets/           KMS CMKs + Secrets Manager placeholders
│   │   ├── observability/     CloudWatch log groups + PHI-leak alarm stub
│   │   └── iam/               least-privilege roles (app / ci / db-admin)
│   ├── envs/
│   │   ├── dev/       fully wired, ready to `plan`
│   │   ├── staging/   placeholder (fill in after dev validated)
│   │   └── prod/      placeholder (fill in after staging validated)
│   └── versions.tf    Terraform + provider version pins
├── scripts/
│   ├── bootstrap-state.sh     ONE-TIME: creates S3 state bucket + DDB lock table
│   ├── tf-plan.sh             safe `terraform plan` wrapper
│   └── tf-apply.sh            apply wrapper (prints human-confirmation banner)
└── docs/
    ├── HIPAA-POSTURE.md       how this stack meets HIPAA requirements
    └── DISASTER-RECOVERY.md   RPO/RTO stub + future cross-region notes
```

## Module summary

| Module | What it does |
|---|---|
| `network` | VPC `10.0.0.0/16`, 2 AZs (`us-west-1a`, `us-west-1c`), public/app/db subnets, single NAT (dev), VPC flow logs → CloudWatch 90d |
| `database` | RDS Postgres 16 `db.t4g.medium` dev, gp3 100 GB encrypted (customer CMK), 7d backups, Performance Insights, SSL forced, no Multi-AZ for dev |
| `secrets` | 3 KMS CMKs (RDS, app, S3) with annual rotation + 5 Secrets Manager placeholders (`DATABASE_URL`, WorkOS × 3, `DOPPLER_TOKEN`) |
| `observability` | CloudWatch log groups for app + api (KMS-encrypted, 90d), SSN regex metric filter → `PHI_LEAK_COUNT` alarm → SNS placeholder topic |
| `iam` | 3 roles: `app-runtime`, `ci-deploy` (GitHub OIDC), `db-admin` (human SSO) — no wildcard actions |

## Using this (without applying)

```bash
# 1. One-time state-backend bootstrap (MANUAL, requires account ID + bucket name)
./scripts/bootstrap-state.sh

# 2. Uncomment the backend block in terraform/envs/dev/backend.tf

# 3. Plan only (safe — no changes)
./scripts/tf-plan.sh dev

# 4. Apply (REQUIRES HUMAN CONFIRMATION — do not automate)
./scripts/tf-apply.sh dev
```

## Secret rotation cadence

| Secret | Rotation |
|---|---|
| RDS master password | 90d (manual until Secrets Manager rotation lambda added) |
| WorkOS API / client / webhook | on WorkOS-initiated rotation |
| Doppler service token | 180d |
| KMS CMKs | annual auto-rotate (AWS-managed) |

## Who to ping before apply

Placeholder — fill in once ops rotation is defined. Until then: **Ikeem (owner)** must approve every `apply` against `staging` or `prod`.

## Guardrails

- No `Action = "*"` or `Resource = "*"` unconditionally — grep enforced.
- No hardcoded AWS account IDs.
- All placeholder secrets carry the literal string `PLACEHOLDER_REPLACE_ME`; Secrets Manager is the source of truth post-bootstrap.
- Terraform state lives in S3 with DynamoDB locking (after bootstrap).

## Not in scope here

- CloudTrail org-wide (separate org account setup)
- GuardDuty / Security Hub (0.8)
- Datadog agent + PHI scrub pipeline (0.6)
- Doppler ↔ Secrets Manager sync (0.7)
- WorkOS tenant bootstrap (0.4)
