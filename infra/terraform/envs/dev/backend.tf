############################################
# backend.tf — S3 remote state + DynamoDB lock table
#
# DO NOT uncomment until scripts/bootstrap-state.sh has run ONCE to create
# the bucket + table in this AWS account. Filling this in before that bootstrap
# will cause `terraform init` to fail.
#
# After bootstrap, replace the <PLACEHOLDER_*> values and uncomment the block.
############################################

# terraform {
#   backend "s3" {
#     bucket         = "<PLACEHOLDER_TF_STATE_BUCKET>"   # e.g. christina-crm-tfstate-<acct-id>
#     key            = "envs/dev/terraform.tfstate"
#     region         = "us-west-1"
#     dynamodb_table = "<PLACEHOLDER_TF_LOCK_TABLE>"     # e.g. christina-crm-tf-locks
#     encrypt        = true
#     kms_key_id     = "alias/christina-crm-tfstate"     # create manually alongside the bucket
#   }
# }
