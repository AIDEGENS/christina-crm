#!/usr/bin/env bash
############################################
# bootstrap-state.sh — ONE-TIME: create S3 bucket + DynamoDB lock table
# for Terraform remote state.
#
# RUN MANUALLY. Not invoked by CI. Safe-fails if resources already exist.
############################################

set -euo pipefail

REGION="${AWS_REGION:-us-west-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID=<12-digit-id> before running}"
BUCKET="${TF_STATE_BUCKET:-christina-crm-tfstate-${ACCOUNT_ID}}"
TABLE="${TF_LOCK_TABLE:-christina-crm-tf-locks}"
KMS_ALIAS="alias/christina-crm-tfstate"

echo "================================================================"
echo " Terraform state backend bootstrap"
echo "   Account: ${ACCOUNT_ID}"
echo "   Region:  ${REGION}"
echo "   Bucket:  ${BUCKET}"
echo "   Table:   ${TABLE}"
echo "================================================================"
echo
echo "THIS SCRIPT WILL CREATE AWS RESOURCES. Press Ctrl-C within 10s to abort."
sleep 10

# --- KMS key for state encryption -------------------------------------------
if ! aws kms describe-key --key-id "${KMS_ALIAS}" --region "${REGION}" >/dev/null 2>&1; then
  echo "[kms] creating CMK + alias ${KMS_ALIAS}"
  KEY_ID=$(aws kms create-key \
    --region "${REGION}" \
    --description "christina-crm terraform state encryption" \
    --key-usage ENCRYPT_DECRYPT \
    --origin AWS_KMS \
    --query 'KeyMetadata.KeyId' --output text)
  aws kms enable-key-rotation --region "${REGION}" --key-id "${KEY_ID}"
  aws kms create-alias --region "${REGION}" --alias-name "${KMS_ALIAS}" --target-key-id "${KEY_ID}"
else
  echo "[kms] ${KMS_ALIAS} already exists — skipping"
fi

# --- S3 bucket --------------------------------------------------------------
if ! aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "[s3] creating ${BUCKET}"
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}"

  aws s3api put-bucket-versioning \
    --bucket "${BUCKET}" \
    --versioning-configuration Status=Enabled

  aws s3api put-bucket-encryption \
    --bucket "${BUCKET}" \
    --server-side-encryption-configuration "{
      \"Rules\": [{
        \"ApplyServerSideEncryptionByDefault\": {
          \"SSEAlgorithm\": \"aws:kms\",
          \"KMSMasterKeyID\": \"${KMS_ALIAS}\"
        },
        \"BucketKeyEnabled\": true
      }]
    }"

  aws s3api put-public-access-block \
    --bucket "${BUCKET}" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
else
  echo "[s3] bucket ${BUCKET} already exists — skipping"
fi

# --- DynamoDB lock table ----------------------------------------------------
if ! aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "[ddb] creating ${TABLE}"
  aws dynamodb create-table \
    --region "${REGION}" \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true,SSEType=KMS,KMSMasterKeyId="${KMS_ALIAS}"
else
  echo "[ddb] table ${TABLE} already exists — skipping"
fi

cat <<EOF

================================================================
 Bootstrap complete.
 Next:
   1. Open infra/terraform/envs/dev/backend.tf
   2. Uncomment the backend block
   3. Replace <PLACEHOLDER_TF_STATE_BUCKET> with: ${BUCKET}
   4. Replace <PLACEHOLDER_TF_LOCK_TABLE>  with: ${TABLE}
   5. Run:  ./scripts/tf-plan.sh dev
================================================================
EOF
