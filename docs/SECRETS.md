# Secrets Management — AWS SSM Parameter Store

AWS SSM Parameter Store is the single source of truth for production secrets
in the `medical-crm` project. Local development reads from a gitignored
`.env` file; staging and production pull from SSM at container boot via the
ECS task IAM role.

## Naming convention

```
/medical-crm/${env}/${KEY}
```

- `env` ∈ `dev` | `stg` | `prd`
- `KEY` is the SHOUTY_SNAKE_CASE variable name from `.env.example`
  (e.g. `DATABASE_URL`, `WORKOS_API_KEY`).

Type: `SecureString`. KMS key: `alias/medical-crm` (customer-managed CMK,
rotation enabled, provisioned via terraform in Phase B).

## Local development

Local dev does NOT read SSM — it reads the gitignored `.env` file in the
repo root. `packages/config/src/secrets.ts` detects
`NODE_ENV !== 'production'` and returns an empty object, so
`process.env.DATABASE_URL` falls through to whatever is in `.env`.

Rule: never commit real values to `.env.example`; use `REPLACE_ME` only.

## Production / staging

At container boot, `apps/api/src/bootstrap.ts` calls
`loadSecrets(APP_ENV)`. That function issues one
`ssm:GetParametersByPath` call (recursive, with decryption) against
`/medical-crm/${APP_ENV}/` and merges every returned value into
`process.env` before the server starts.

The ECS task role grants exactly:

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParametersByPath"],
  "Resource": "arn:aws:ssm:us-west-1:<account>:parameter/medical-crm/${env}/*"
},
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt"],
  "Resource": "arn:aws:kms:us-west-1:<account>:alias/medical-crm"
}
```

No secret ever lands in an ECS task definition environment block. No
secret ever hits GitHub Actions except the Turbo remote-cache token
(non-sensitive) and the AWS account ID (public ARN component).

## Bootstrap / populate

Use the helper:

```bash
./scripts/ssm-setup.sh dev     # or stg, prd
```

It reads keys from `.env.example` (skipping local-only ones like
`AI_CHANNEL_IDENTITY`, `DEV_AUTH_*`), checks whether each
`/medical-crm/<env>/<KEY>` already exists, and prompts for missing values.
Never overwrites.

Rotate an existing value explicitly:

```bash
aws ssm put-parameter \
  --name /medical-crm/prd/DATABASE_URL \
  --type SecureString \
  --key-id alias/medical-crm \
  --value "postgresql://…" \
  --overwrite
```

## CI/CD integration

GitHub Actions uses OIDC to assume the `gha-deploy` IAM role in the target
account. The role grants `ecr:*` on the two repositories and
`ecs:UpdateService` + `iam:PassRole` on the task roles — but NOT
`ssm:GetParameter*`. Deploy-time does not read secrets; the deployed
container does.

## Rotation procedure

### Standard quarterly (DB, AWS, WorkOS)

1. Generate new credential in the source system.
2. `aws ssm put-parameter ... --overwrite` against the target env.
3. Force a new ECS deployment:
   `aws ecs update-service --force-new-deployment --cluster christina-crm-prd --service christina-crm-api`.
4. Verify end-to-end.
5. Revoke the old credential at the source.
6. Log the rotation in the audit calendar.

### On-event (suspected leak)

Same flow as above, but: (a) do not wait for the quarterly window, and
(b) grep the repo + recent git log for the old value before rotating to
confirm it wasn't committed.

## Access control

| Role       | Who                 | SSM Access                     |
|------------|---------------------|--------------------------------|
| Owner      | clay@ (primary)     | All envs, kms key admin        |
| Developer  | Active contributors | `dev` read (via IAM user role) |
| ReadOnly   | Contractors         | None — use dev `.env` only     |
| ECS task   | per-service         | Env-scoped `/medical-crm/*`    |

Prod access is Owner-only + MFA-enforced. Developer roles never get write
access outside `dev`.

## Audit log

CloudTrail captures every `ssm:GetParameter*` and `kms:Decrypt` call. The
trail is delivered to `s3://medical-crm-audit-us-west-1/cloudtrail/` with
6-year retention for HIPAA.

Monthly review checklist:

- [ ] Unusual `GetParametersByPath` volume from a task role
- [ ] Any `kms:Decrypt` failures (could indicate role drift)
- [ ] Any `PutParameter` / `DeleteParameter` outside a change window

## Hard rules

1. NEVER commit `.env`, `.env.local`, `.env.*.local`, or `terraform.tfvars`.
2. NEVER paste any secret value into Slack, email, GitHub comments, or any chat.
3. NEVER include secrets in `console.log`, error messages, or exception payloads.
4. NEVER add secrets to an ECS task definition environment block — use SSM.
5. NEVER share AWS access keys; always use SSO + role assumption.
6. NEVER create IAM roles with broader scope than needed. One role per ECS service.
7. NEVER use long-lived AWS keys in GitHub Actions — always OIDC.
8. NEVER skip rotation after a suspected exposure. When in doubt, rotate.
9. `.env.example` MUST use `REPLACE_ME` placeholders — no real-looking values.
10. AWS BAA must be signed in AWS Artifact before prod SSM is populated.
11. `DEV_AUTH_TENANT_ID` and `DEV_AUTH_ROLE` MUST NEVER exist in `/medical-crm/stg/`
    or `/medical-crm/prd/`. They bypass the real tenant lookup and are a direct
    auth-bypass risk. The API throws `DEV_SHIM_IN_PROD` at module load if
    `NODE_ENV === 'production'` and either var is set, which means a
    misconfigured prod SSM will crash-loop the container — by design. The
    check lives in code (`packages/auth/src/tenant.ts::assertDevAuthNotInProd`)
    and is verified as part of `Plans/phase-0-foundation/PHASE-0-EXIT.md`.
