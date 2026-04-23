# Secrets Handoff — User-Blocked Checklist (AWS SSM)

These steps require your AWS account and cannot be automated.
Complete them in order before running the project in staging or production.

Reference `.env.example` for the full list of secrets to populate.
Reference `docs/SECRETS.md` for the rotation, access, and audit procedures.

---

## AWS account setup

- [ ] Sign the HIPAA BAA in AWS Artifact (Console → Artifact → Agreements → AWS BAA → click-sign). Free.
- [ ] Enable CloudTrail across all regions (should be default for new accounts).
- [ ] Enable MFA on the root account and every IAM user.

## KMS key + SSM hierarchy

- [ ] Apply the Phase B terraform module `infra/terraform/modules/ssm/`:
  - Creates KMS key `alias/medical-crm` with rotation enabled.
  - Creates the `/medical-crm/dev/`, `/medical-crm/stg/`, `/medical-crm/prd/` parameter paths.
  - Creates the per-service IAM task role with `ssm:GetParametersByPath` + `kms:Decrypt` scoped to its env.

## Populate secrets

For each env (start with dev), run the helper:

```bash
./scripts/ssm-setup.sh dev
./scripts/ssm-setup.sh stg
./scripts/ssm-setup.sh prd
```

The script walks every key in `.env.example` and prompts for values. It
skips keys that already exist — rerun it safely after adding a new key.

Required keys per env (from `.env.example`):

- [ ] AWS section: `AWS_REGION`, `S3_BUCKET`, `KMS_KEY_ID` (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are NOT stored in SSM — use the ECS task role).
- [ ] Database section: `DATABASE_URL` (and `DATABASE_URL_READONLY` if using a read replica).
- [ ] WorkOS section: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD` or `WORKOS_COOKIE_PASSWORD_KEYRING`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_ISSUER`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_WORKOS_ENV`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.
- [ ] App section: `LOG_LEVEL`, `GIT_SHA`, `NEXT_PUBLIC_APP_URL`.
- [ ] Repeat for stg and prd.

## GitHub Actions OIDC

- [ ] In IAM, create role `gha-deploy` with a trust policy pinned to
      `repo:AIDEGENS/christina-crm:ref:refs/heads/main`.
- [ ] Attach policies: `AmazonEC2ContainerRegistryPowerUser`, and an
      inline policy granting `ecs:UpdateService`, `ecs:DescribeServices`,
      `iam:PassRole` on the task roles, `ecs:RegisterTaskDefinition`.
- [ ] Do NOT grant `ssm:GetParameter*` to `gha-deploy` — the container
      fetches its own secrets at boot; CI/CD should never see them.
- [ ] Add `AWS_ACCOUNT_ID` as a GitHub secret (public ARN component, not sensitive).
- [ ] Run a deploy dispatch and verify the OIDC token exchange succeeds.

## Team access

- [ ] Create an IAM Identity Center (SSO) permission set for developers:
      read-only on dev SSM path, no access to stg/prd.
- [ ] Owner-only permission set: full SSM + KMS admin.
- [ ] Enforce MFA at the IAM Identity Center account level.

## Rotation calendar

- [ ] Create calendar entries:
  - Monthly: "Review CloudTrail for unusual SSM access" (first Monday).
  - Quarterly: "Rotate DB password + WorkOS API key" (Jan, Apr, Jul, Oct).
  - Annual: "Review IAM role scopes and revoke stale roles".
- [ ] Add rotation procedure link: this repo `docs/SECRETS.md` → Rotation procedure section.

## Verification

- [ ] `aws ssm get-parameters-by-path --path /medical-crm/dev/ --recursive --with-decryption` returns all expected keys.
- [ ] Deploy a test container; tail CloudWatch Logs and confirm the
      bootstrap log line `{ "msg": "API running", "port": 3001 }` appears.
- [ ] Attempt to read `/medical-crm/prd/*` from the dev developer role —
      expect `AccessDeniedException`.
- [ ] Attempt `ssm:GetParameter` from the GHA role — expect denial.
- [ ] CloudTrail event history lists the container's `GetParametersByPath`.
