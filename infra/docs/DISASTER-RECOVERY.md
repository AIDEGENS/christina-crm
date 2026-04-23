# Disaster Recovery — Christina CRM (Phase 0.2)

**Status:** stub. This doc will be expanded in 0.8 (production hardening). Everything below is the
dev-grade baseline the Phase 0.2 Terraform provides.

## Objectives

| Metric | Dev | Prod (target) |
|---|---|---|
| RPO (Recovery Point Objective) | 7 days | 5 minutes (via PITR) |
| RTO (Recovery Time Objective) | 4 hours | 1 hour |
| Backup retention | 7 days | 30 days |
| Cross-region replication | Not configured | Deferred — tracked below |

## What the Terraform already gives you

- **RDS automated backups** with 7-day retention (dev) or 30-day (prod, via `var.db_backup_retention_days`).
- **Point-in-time recovery (PITR)** within the retention window, 5-minute granularity — this is an RDS default.
- **Multi-AZ standby** — off for dev, on for prod when `var.db_multi_az = true` is set. Gives < 60s automated failover.
- **Deletion protection** on the RDS instance — blocks accidental `terraform destroy`.
- **Versioned S3 state bucket** — Terraform state itself is recoverable even after accidental overwrite or delete (assumes `scripts/bootstrap-state.sh` enabled versioning, which it does).
- **KMS CMKs with 30-day deletion window** — keys cannot be hard-destroyed on first attempt.

## What is deferred

1. **Cross-region read replica** — pending 0.8. Will target `us-west-2` for regional failover.
2. **KMS CMK multi-region replica** — pending 0.8. Required so that a cross-region replica can decrypt storage.
3. **Quarterly restore drill** — not yet scheduled. First drill target: **Q3 2026** (restore a dev snapshot to a scratch instance, validate app can connect, document elapsed time).
4. **Runbook: "RDS is down, what do I do?"** — not written. Placeholder below.
5. **S3 archival (6-year PHI retention)** — Phase 1.x. Not a DR concern per se, but related.

## Placeholder runbook (to be expanded in 0.8)

### Scenario: RDS instance unreachable

1. Confirm outage via CloudWatch `DatabaseConnections` metric and AWS Health Dashboard.
2. If transient (< 5 min): wait and monitor — app-layer retry should self-heal.
3. If instance is truly dead: `aws rds describe-db-instances` → check `Status`.
4. Restore from the most recent automated snapshot via `RestoreDBInstanceFromDBSnapshot`, targeting the same VPC + subnet group + parameter group.
5. Update the app's `DATABASE_URL` secret in Secrets Manager to the new endpoint.
6. Post-mortem within 48 hours.

### Scenario: entire us-west-1 region offline

**Current state:** no cross-region DR. Data is safe (snapshots + state bucket are durable), but restore requires human action and up-front planning.

**Mitigation path (to be implemented in 0.8):**
1. Create cross-region CMK replicas in `us-west-2`.
2. Enable RDS cross-region automated backups.
3. Keep a warm-but-stopped RDS stand-in in `us-west-2` to bring up on failover.

### Scenario: terraform state corrupted or lost

1. Recover from S3 versioning — `aws s3api list-object-versions` on the state bucket.
2. If that fails, rebuild state with `terraform import` resource-by-resource (slow, documented per-module).
3. DynamoDB lock table is disposable — recreate via `bootstrap-state.sh`.

## Action items

- [ ] Schedule Q3 2026 restore drill (calendar invite owner: Ikeem).
- [ ] 0.8: add cross-region CMK + replica.
- [ ] 0.8: expand runbooks with named owners + paging rotation.
- [ ] 0.8: document `terraform import` recipes per-module.
