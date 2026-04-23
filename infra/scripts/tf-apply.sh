#!/usr/bin/env bash
############################################
# tf-apply.sh — applies a previously-created plan.
# Usage: ./tf-apply.sh <env>     (env = dev | staging | prod)
############################################

set -euo pipefail

ENV="${1:?Usage: $0 <env>}"
ENV_DIR="$(cd "$(dirname "$0")/../terraform/envs/${ENV}" && pwd)"

if [[ ! -f "${ENV_DIR}/tfplan" ]]; then
  echo "ERROR: no tfplan found in ${ENV_DIR}. Run ./scripts/tf-plan.sh ${ENV} first."
  exit 1
fi

cat <<'BANNER'
################################################################
#                                                              #
#           APPLY REQUIRES HUMAN CONFIRMATION                  #
#                                                              #
#  This will create, modify, or destroy AWS resources in the   #
#  account tied to your current credentials.                   #
#                                                              #
#  HIPAA-aligned stack — double-check env, account, and        #
#  reviewer sign-off before continuing.                        #
#                                                              #
################################################################
BANNER

read -r -p "Type the env name (${ENV}) to continue: " CONFIRM
if [[ "${CONFIRM}" != "${ENV}" ]]; then
  echo "Aborted."
  exit 1
fi

if [[ "${ENV}" == "prod" || "${ENV}" == "staging" ]]; then
  read -r -p "Has this plan been reviewed by a second engineer? (yes/no): " REVIEW
  if [[ "${REVIEW}" != "yes" ]]; then
    echo "Aborted — ${ENV} applies require peer review."
    exit 1
  fi
fi

echo "=== terraform apply (${ENV}) ==="
terraform -chdir="${ENV_DIR}" apply -input=false tfplan

echo
echo "Apply complete. Review outputs:"
terraform -chdir="${ENV_DIR}" output
