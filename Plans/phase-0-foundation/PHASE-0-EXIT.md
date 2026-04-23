# Phase 0 — Exit Runbook

> **Run this end-to-end before declaring Phase 0 complete and starting Phase 1.** Any failure here blocks Phase 1.

## How to use this runbook

1. Execute each verification command
2. Check off each acceptance line as it passes
3. If ANY item fails, do NOT proceed to Phase 1 — fix the failing step first
4. When all pass, update `STATUS.md` to mark Phase 0 fully complete and current step = `../phase-1-referral-core/1.1-referral-crud.md`

## 1. Repo & local dev

- [ ] `git status` clean (no uncommitted changes that matter)
- [ ] `pnpm install` runs clean with no errors
- [ ] `pnpm turbo build` succeeds
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm turbo lint` passes
- [ ] `doppler run -- pnpm turbo dev --filter=crm-web` starts on :3000
- [ ] `doppler run -- pnpm turbo dev --filter=crm-api` starts on :3001
- [ ] `curl http://localhost:3001/health` returns 200

## 2. AWS infrastructure

- [ ] `aws sts get-caller-identity` confirms correct AWS account
- [ ] `aws rds describe-db-instances --region us-west-1 --query "DBInstances[?DBName=='crm']"` returns the RDS instance
- [ ] RDS endpoint resolves: `nslookup <rds-endpoint>`
- [ ] Can connect: `doppler run -- psql "$DATABASE_URL" -c "SELECT version();"` returns Postgres 16.x
- [ ] `aws s3 ls s3://medical-crm-docs-dev-us-west-1` returns without error
- [ ] `aws kms list-aliases --region us-west-1 | grep crm` shows both RDS and S3 KMS aliases
- [ ] All resources in us-west-1: `aws rds describe-db-instances --query "DBInstances[].AvailabilityZone"` shows `us-west-1a` or `us-west-1c`

## 3. Postgres schema + RLS

Connect to DB: `doppler run -- psql "$DATABASE_URL"`

- [ ] `\dt crm.*` shows all 9 tables: tenants, users, organizations, contacts, referrals, referral_notes, referral_documents, bd_visits, audit_log
- [ ] `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='crm';` — all show `rowsecurity = t`
- [ ] `SELECT policyname, tablename FROM pg_policies WHERE schemaname='crm';` — policies exist on all 9 tables
- [ ] `\dx` shows pgcrypto, uuid-ossp, pg_trgm extensions installed
- [ ] `\di crm.*` shows all expected indexes
- [ ] `SELECT count(*) FROM crm.tenants;` returns 2 (HH + Hospice seeded)

### RLS smoke test

```sql
-- As crm_app role (not superuser)
SET ROLE crm_app;
SET LOCAL app.current_tenant = '<TENANT_HH_UUID>';
SELECT count(*) FROM crm.referrals;
-- Expected: only HH tenant's rows

SET LOCAL app.current_tenant = '<TENANT_HOSPICE_UUID>';
SELECT count(*) FROM crm.referrals;
-- Expected: only Hospice tenant's rows (different count)

RESET app.current_tenant;
SELECT count(*) FROM crm.referrals;
-- Expected: 0 (RLS blocks with no tenant set)
```

- [ ] RLS smoke test passes all three scenarios

### Audit log immutability

```sql
INSERT INTO crm.audit_log (tenant_id, user_id, action, resource_type, resource_id)
VALUES ('<uuid>', '<uuid>', 'test', 'test', '<uuid>');

-- These should fail
UPDATE crm.audit_log SET action = 'hacked' WHERE action = 'test';
DELETE FROM crm.audit_log WHERE action = 'test';
```

- [ ] UPDATE on audit_log fails (RLS policy blocks)
- [ ] DELETE on audit_log fails

## 4. WorkOS auth

- [ ] Visit `/dashboard` while logged out → redirects to `/login`
- [ ] Click "Continue with SSO" → WorkOS-hosted login page appears
- [ ] Login with admin user → redirects back to `/dashboard`
- [ ] Logout → returns to `/login`, session cleared
- [ ] Try to visit `/dashboard` without being in `crm.users` → redirects to `/unauthorized`
- [ ] MFA is enforced for admin role (check in WorkOS dashboard)
- [ ] Session cookie is httpOnly, Secure, SameSite=Strict (check in browser devtools)
- [ ] `hasRole("admin", "intake")` returns true; `hasRole("bd_rep", "admin")` returns false

## 5. Vercel deployment

- [ ] Deployment URL returns 200 at `/login`
- [ ] `curl -I <deployment-url>` shows security headers: X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] Region is `sfo1` (check `x-vercel-cache` or deployment detail page)
- [ ] Deployment is on Vercel Enterprise team (check team settings; BAA active)
- [ ] PR preview deployments work: push a no-op commit to a branch → Vercel builds preview
- [ ] WorkOS redirect URI for Vercel URL is registered (in WorkOS dashboard)

## 6. Datadog observability

- [ ] APM traces for crm-api visible in Datadog within 2 minutes of a request
- [ ] APM traces for crm-web visible
- [ ] Logs from both services visible with trace IDs linking request → log
- [ ] RUM sessions visible from the Vercel deployment URL
- [ ] RUM session replay masks form inputs (test: type into a form, view replay)
- [ ] Sensitive Data Scanner rules are active (UI → Security → Sensitive Data Scanner)
- [ ] Test log with PHI-shaped payload (`{ patient_mrn: "ABC123456" }`) → Datadog shows `[REDACTED]`
- [ ] Custom metric `crm.rls.policy_blocked` is emitting (try to query with wrong tenant in test)
- [ ] Dashboard "Medical CRM Health" exists and has panels
- [ ] Alert for `crm.rls.policy_blocked > 0` is configured
- [ ] Datadog BAA is active

## 7. Secrets (Doppler)

- [ ] `doppler secrets` lists all required secrets for the `dev` config
- [ ] `DEV_AUTH_TENANT_ID` and `DEV_AUTH_ROLE` are ABSENT from Doppler `staging` and `prod` configs
      (Run `doppler secrets --config staging --only-names` and `doppler secrets --config prod --only-names`
      — neither key may appear. The API throws `DEV_SHIM_IN_PROD` at boot if either leaks into prod.)
- [ ] `WORKOS_ISSUER` is set in all three configs (dev/staging/prod) — required for JWT verification
- [ ] `WORKOS_COOKIE_PASSWORD_KEYRING` is set in staging/prod (single-key form OK for dev)
- [ ] `ALLOWED_ORIGINS` is set in all three configs (required, empty fails closed)
- [ ] No secrets in Vercel UI manually (removed in favor of Doppler sync)
- [ ] `grep -rE "(AKIA|sk-|ghp_|password|SECRET)" .` returns no results in tracked files (rule out accidental commits; may flag example files which is fine)
- [ ] `git log --all -p | grep -iE "(API_KEY|SECRET_KEY|PASSWORD|DATABASE_URL)" | head` — nothing leaked in history
- [ ] Doppler project has dev/staging/prod configs
- [ ] Vercel Doppler integration is linked and syncing
- [ ] CI workflow uses `doppler run` (ci.yml + deploy.yml both updated — verify with a CI run)
- [ ] Rotation calendar entries created
- [ ] Doppler BAA is active
- [ ] `docs/SECRETS-HANDOFF.md` checklist fully completed (all checkboxes ticked)
- [ ] `scripts/doppler-setup.sh` runs clean on a fresh clone: `./scripts/doppler-setup.sh`
- [ ] `.env.example` contains all vars from `process.env.` grep across codebase (count: 20 vars)
- [ ] `.gitignore` blocks `.env.*`, `terraform.tfvars`, `*.tfvars` (verified with `git check-ignore -v .env.production`)
- [ ] Service tokens scoped per environment (not personal tokens) — verify in Doppler UI -> Service Tokens
- [ ] `doppler run -- pnpm turbo lint typecheck build` passes end-to-end without manually set env vars

## 8. Compliance posture summary

Before moving to Phase 1, confirm all BAAs required for Phase 0 are signed:

- [ ] AWS (RDS + S3 + KMS + SES + Bedrock under single BAA)
- [ ] Vercel Enterprise
- [ ] WorkOS
- [ ] Datadog
- [ ] Doppler
- [ ] GitHub Enterprise

Reference `../../Insurance Claims/REF/BAA-CHECKLIST.md` for the status tracker.

- [ ] All BAAs above show `SIGNED` status
- [ ] Original signed PDFs stored in 1Password → "Compliance/BAAs" vault

## 9. Decision log updates

Add to `../STATUS.md` Notes section:

- Dev deployment URL
- RDS endpoint (not password — that's in Doppler)
- Tenant UUIDs (HH + Hospice)
- Admin user WorkOS ID
- Any deviations from the plan or notable decisions

## 10. Gate check

If **every** checkbox above is checked:

1. Edit `../STATUS.md`:
   - Set current phase to `Phase 1 — Referral core`
   - Set current step to `1.1 — Referral CRUD`
   - Move all Phase 0 steps (0.1-0.7) to the Completed list
   - Update progress: `Phase 0 — Foundation: 7 / 7`
2. Commit: `git commit -am "phase 0 complete — all exit criteria verified"`
3. Tag: `git tag phase-0-complete && git push --tags`
4. Post in team channel: "Phase 0 done. Starting Phase 1."

If ANY checkbox is NOT checked:
- Document why in the failing step file
- Mark that step as IN_PROGRESS or BLOCKED
- Do NOT advance to Phase 1

## Next

→ `../phase-1-referral-core/1.1-referral-crud.md`

## Revision history
- 2026-04-15: Initial exit runbook — covers 0.1 through 0.7
