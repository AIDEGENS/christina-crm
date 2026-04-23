#!/usr/bin/env bash
############################################
# tf-plan.sh — safe `terraform plan` wrapper.
# Usage: ./tf-plan.sh <env>     (env = dev | staging | prod)
############################################

set -euo pipefail

ENV="${1:?Usage: $0 <env>}"
ENV_DIR="$(cd "$(dirname "$0")/../terraform/envs/${ENV}" && pwd)"

if [[ ! -f "${ENV_DIR}/main.tf" ]]; then
  echo "ERROR: ${ENV_DIR} has no main.tf. Is this env scaffolded yet?"
  exit 1
fi

echo "=== terraform init (${ENV}) ==="
terraform -chdir="${ENV_DIR}" init -input=false

echo
echo "=== terraform validate (${ENV}) ==="
terraform -chdir="${ENV_DIR}" validate

echo
echo "=== terraform plan (${ENV}) ==="
terraform -chdir="${ENV_DIR}" plan -input=false -out=tfplan

echo
echo "Plan written to ${ENV_DIR}/tfplan"
echo "Review it, then run: ./scripts/tf-apply.sh ${ENV}"
