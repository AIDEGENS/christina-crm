#!/usr/bin/env bash
# scripts/ssm-setup.sh — interactive SSM Parameter Store bootstrap
#
# Usage: ./scripts/ssm-setup.sh <env>
#   env: one of `dev` | `stg` | `prd`
#
# What it does:
#   1. Verifies aws CLI is authenticated against the target account
#   2. Reads keys from .env.example (ignores blank / comment lines)
#   3. For each key:
#      a. Checks whether /medical-crm/${env}/${KEY} already exists
#      b. If missing, prompts interactively and writes a SecureString
#         encrypted with alias/medical-crm
#   4. Never overwrites an existing parameter — rotate via
#      `aws ssm put-parameter --overwrite` explicitly.

set -euo pipefail

ENV="${1:-}"
if [[ -z "${ENV}" ]]; then
  echo "Usage: $0 <env>   (env must be: dev | stg | prd)" >&2
  exit 2
fi

case "${ENV}" in
  dev|stg|prd) ;;
  *) echo "ERROR: env must be dev | stg | prd, got '${ENV}'" >&2; exit 2 ;;
esac

# ---------------------------------------------------------------------------
# 1. Check aws CLI
# ---------------------------------------------------------------------------
if ! command -v aws &>/dev/null; then
  echo "ERROR: aws CLI not found. Install via https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 1
fi

if ! aws sts get-caller-identity --output text >/dev/null 2>&1; then
  echo "ERROR: aws CLI is not authenticated. Run 'aws configure' or set AWS_PROFILE." >&2
  exit 1
fi

CALLER=$(aws sts get-caller-identity --query Arn --output text)
echo "[ssm] authenticated as: ${CALLER}"
echo "[ssm] target env:       ${ENV}"
echo "[ssm] kms alias:        alias/medical-crm"
echo

# ---------------------------------------------------------------------------
# 2. Parse .env.example → KEY list
# ---------------------------------------------------------------------------
ENV_EXAMPLE="$(dirname "$0")/../.env.example"
if [[ ! -f "${ENV_EXAMPLE}" ]]; then
  echo "ERROR: ${ENV_EXAMPLE} not found" >&2
  exit 1
fi

# Extract bare KEY from every `KEY=value` line. Skip `#` comments and blanks.
KEYS=$(grep -E '^[A-Z_][A-Z0-9_]*=' "${ENV_EXAMPLE}" | cut -d= -f1)

# ---------------------------------------------------------------------------
# 3. Per-key: exists? skip. missing? prompt + put-parameter.
# ---------------------------------------------------------------------------
CREATED=0
SKIPPED=0
for KEY in ${KEYS}; do
  # Skip keys that should never live in SSM
  case "${KEY}" in
    AI_CHANNEL_IDENTITY|DEV_AUTH_TENANT_ID|DEV_AUTH_ROLE|NODE_ENV|PORT|LOG_LEVEL)
      continue
      ;;
  esac

  PARAM_NAME="/medical-crm/${ENV}/${KEY}"

  if aws ssm get-parameter --name "${PARAM_NAME}" --with-decryption >/dev/null 2>&1; then
    echo "[ssm] SKIP ${PARAM_NAME} (exists)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # shellcheck disable=SC2162
  read -rp "[ssm] enter value for ${KEY} (empty = skip): " VALUE
  if [[ -z "${VALUE}" ]]; then
    echo "[ssm] skipped (no value)"
    continue
  fi

  aws ssm put-parameter \
    --name "${PARAM_NAME}" \
    --type SecureString \
    --key-id alias/medical-crm \
    --value "${VALUE}" \
    --description "christina-crm ${ENV} secret: ${KEY}" \
    >/dev/null

  echo "[ssm] WROTE ${PARAM_NAME}"
  CREATED=$((CREATED + 1))
done

echo
echo "[ssm] done: created=${CREATED} skipped=${SKIPPED}"
echo "[ssm] rotate an existing param with:"
echo "       aws ssm put-parameter --name /medical-crm/${ENV}/DATABASE_URL \\"
echo "         --type SecureString --key-id alias/medical-crm \\"
echo "         --value '...' --overwrite"
