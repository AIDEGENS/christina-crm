# HIPAA Posture — Christina CRM infra (Phase 0.2)

This document maps the Terraform scaffold in `infra/terraform/` to the HIPAA Security Rule
technical safeguards (45 CFR §164.312). It is scoped to **infrastructure only** — application-layer
controls (tenant RLS, audit trail, session management) live in the app code and in separate docs.

## 1. AWS BAA scope

AWS offers a single Business Associate Addendum covering all HIPAA-eligible services.
Every service used by this scaffold is on the HIPAA-eligible list as of 2026:

| Service | Used for | Eligible |
|---|---|---|
| Amazon RDS (Postgres) | Primary data store | Yes |
| Amazon S3 | Document storage (future; bucket in 0.3) | Yes |
| Amazon CloudWatch Logs | Application + VPC flow logs | Yes |
| AWS Secrets Manager | App + integration secrets | Yes |
| AWS KMS | CMK encryption | Yes |
| Amazon VPC | Network isolation | Yes |
| Amazon SNS | PHI-leak alarm routing | Yes |
| AWS IAM | Access control | Yes (infra mgmt) |

**Action item (out of scope here):** sign the AWS BAA with the target account **before** any PHI
enters `dev`. The BAA is per-account, not per-service.

## 2. Encryption at Rest — §164.312(a)(2)(iv)

| Resource | Key | Rotation |
|---|---|---|
| RDS Postgres storage | Customer CMK `alias/christina-crm-<env>-rds` | Annual auto-rotate |
| RDS Performance Insights | Same RDS CMK | Annual |
| RDS automated backups | Same RDS CMK (inherits) | Annual |
| Secrets Manager | Customer CMK `alias/christina-crm-<env>-app` | Annual |
| CloudWatch log groups (app, api, flow-logs) | Customer CMK `alias/christina-crm-<env>-app` | Annual |
| SNS topics | Same app CMK | Annual |
| Future S3 buckets (0.3) | Customer CMK `alias/christina-crm-<env>-s3` | Annual |

All 3 CMKs are created in `modules/secrets/` with:
- `enable_key_rotation = true`
- `deletion_window_in_days = 30` (cannot hard-delete keys on first try)
- Key policy limited to the root principal (no cross-account grants)

## 3. Encryption in Transit — §164.312(e)(1)

| Path | Mechanism |
|---|---|
| Client → Vercel edge | TLS 1.2+ terminated at Vercel |
| Vercel functions → RDS | `rds.force_ssl = 1` parameter group enforces SSL on every connection |
| App → Secrets Manager / KMS | AWS SDK uses TLS by default; no alternative transport exposed |
| VPC-internal service-to-service (future) | **TODO 0.5**: add VPC endpoints for S3, Secrets Manager, KMS, CloudWatch to avoid NAT-routed egress |

The `rds.force_ssl = 1` parameter is on the default parameter group assigned to the RDS instance —
any client attempting non-TLS will be rejected at the Postgres layer.

## 4. Access Control — §164.312(a)(1)

### Network-layer

- RDS Postgres is in **private DB subnets** with **no route to the internet** (route table has no default route).
- DB security group ingress allows `5432/tcp` only from the **private app subnet CIDRs**. All other traffic is denied.
- The default VPC security group is hardened to deny all ingress/egress (see `modules/network/aws_default_security_group`).

### IAM-layer

Three roles, no wildcards:

| Role | Assumed by | Scope |
|---|---|---|
| `christina-crm-<env>-app-runtime` | EC2 / Lambda / ECS tasks | 5 named secret ARNs, 3 named KMS CMKs, 2 named log groups, `rds-db:connect` to `app_user` only |
| `christina-crm-<env>-ci-deploy` | GitHub Actions OIDC (sub `repo:AIDEGENS/christina-crm:*`) | ECR push + ECS update-service on `christina-crm-<env>-*` only, PutMetric in `ChristinaCRM/<env>` namespace, explicit deny on `iam:*`, `rds:Delete*`, `kms:ScheduleKeyDeletion` |
| `christina-crm-<env>-db-admin` | Named human SSO principals only, **MFA required** via `aws:MultiFactorAuthPresent` condition | `rds-db:connect` as `db_admin`, describe RDS + read CloudWatch logs — no write, no delete |

Every IAM policy explicitly enumerates actions and resources. No `Action: "*"` or `Resource: "*"`
is used unconditionally. The only `Resource = "*"` appearances are:
- `ecr:GetAuthorizationToken` — AWS-mandated, account-wide by design
- `cloudwatch:PutMetricData` — scoped by `cloudwatch:namespace` condition
- Explicit `Deny` statements — "Resource: *" is correct and safer here

## 5. Audit Controls — §164.312(b)

| Log source | Destination | Retention |
|---|---|---|
| VPC flow logs (ALL traffic) | `/christina-crm/<env>/vpc-flow-logs` | 90 days |
| RDS Postgres logs (`postgresql`, `upgrade`) | RDS → CloudWatch | 90 days (default CW retention inherited) |
| Application logs | `/christina-crm/<env>/app` | 90 days |
| API logs | `/christina-crm/<env>/api` | 90 days |
| `log_connections`, `log_disconnections`, `log_statement = ddl` | Postgres param group → CW | 90 days |

**PHI-leak canary:** a CloudWatch Logs metric filter on `/app` matches the SSN regex
`%[0-9]{3}-[0-9]{2}-[0-9]{4}%` and increments the `PHI_LEAK_COUNT` metric.
A CloudWatch alarm fires on **any non-zero count over 5 minutes** and publishes to an SNS topic.
The SNS topic ships with **no subscribers** — 0.6 will wire it to PagerDuty + Slack.

**Out of scope here (separate tickets):**
- Org-wide CloudTrail (`0.8 / security-team`)
- GuardDuty + Security Hub (`0.8`)
- AWS Config rules (`0.8`)
- Access reviews (quarterly cadence, to be added to the Compliance runbook)

## 6. Retention — §164.316

| Data class | Retention | Rationale |
|---|---|---|
| App / API / flow logs | 90 days | Balances forensics window vs. storage cost. Prod may extend to 365 in 0.8. |
| RDS automated backups (dev) | 7 days | Cheap dev posture. Prod = 30d (var-gated). |
| RDS automated backups (prod) | 30 days | HIPAA min 6y for PHI is handled by application-layer archival (S3 Glacier, Phase 1.x) — **not** automated RDS backups. |
| KMS keys pending deletion | 30 days | Recoverable window. |
| Secrets Manager versions | Managed by rotation; no explicit retention |

**Gap flagged:** the 6-year PHI retention mandate is *not* met by RDS automated backups alone.
The Phase 1.x archival pipeline (S3 Glacier Deep Archive + Object Lock Compliance mode) is the
system of record for that requirement. Do not claim 6-year coverage until that ships.

## 7. Integrity — §164.312(c)(1)

- RDS automated backups + point-in-time recovery via transaction logs (5-minute RPO inside the retention window).
- S3 state bucket (see `scripts/bootstrap-state.sh`) uses versioning + object lock optional + SSE-KMS.
- CloudWatch log groups inherit KMS at-rest integrity; CloudWatch itself does not support log-level hash chains (TODO if regulator requires: forward to SIEM in 0.8).

## 8. What is explicitly NOT covered here

| Concern | Where it lives |
|---|---|
| ePHI transport scrubbing (log redaction before emit) | **0.6** — Datadog agent + custom PHI filter |
| Tenant isolation (RLS per-tenant) | **Phase 1.0** — `packages/db` + middleware |
| Access reviews cadence | Compliance runbook (not yet authored) |
| Incident response runbook | Separate doc in `REF/` (not yet authored) |
| Employee training / BAA sub-processor list | Organizational, out of scope for infra |
| Key rotation automation for app secrets | **0.7** — Doppler ↔ Secrets Manager sync |

## 9. Open TODOs (flagged for follow-up)

1. **Enable CloudTrail org-wide** — currently assumed to be configured at the org account level. Verify before prod go-live.
2. **Enable GuardDuty + Security Hub** — scheduled for 0.8.
3. **Add VPC endpoints** for S3, Secrets Manager, KMS, CloudWatch Logs — so that in-VPC traffic to those services doesn't traverse NAT + public internet. Follow-up ticket.
4. **Cross-region CMK replica** for DR — deferred; see `DISASTER-RECOVERY.md`.
5. **Automated RDS snapshot → S3 export** for 6-year PHI retention — deferred to Phase 1.x archival.
6. **SNS PHI-alarm subscriptions** — attach PagerDuty + Slack in 0.6.
7. **Wire `db_admin_principal_arns`** — currently an empty list; no human can assume the role until populated.
8. **GitHub OIDC provider** — must be created in the account manually (one-time) before `ci_deploy` can assume. ARN goes into `terraform.tfvars`.

## 10. Verification commands (post-apply)

```bash
# Confirm RDS storage is encrypted with the expected CMK
aws rds describe-db-instances --db-instance-identifier christina-crm-dev \
  --query 'DBInstances[0].{Encrypted:StorageEncrypted,Kms:KmsKeyId}'

# Confirm force_ssl is on
aws rds describe-db-parameters --db-parameter-group-name christina-crm-dev-pg16 \
  --query "Parameters[?ParameterName=='rds.force_ssl'].ParameterValue"

# Confirm log group KMS
aws logs describe-log-groups --log-group-name-prefix /christina-crm/dev \
  --query 'logGroups[].{Name:logGroupName,Kms:kmsKeyId,Retention:retentionInDays}'

# Confirm default SG is locked down (should return empty ingress + egress)
aws ec2 describe-security-groups --group-ids <default-sg-id> \
  --query 'SecurityGroups[0].{Ingress:IpPermissions,Egress:IpPermissionsEgress}'
```
