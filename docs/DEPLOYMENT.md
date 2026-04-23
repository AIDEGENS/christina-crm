# Deployment — ECS Fargate (AWS-only)

Scope: how to ship `christina-crm-web` and `christina-crm-api` to AWS.
Detailed terraform / runbook body fills in during Phase B apply.

## Architecture (target)

```
           Route53
              │
      ┌───────┴───────┐
      │               │
 app.env.domain   api.env.domain
      │               │
  CloudFront          │
      │               │
     ALB  (host-based routing)
      │               │
  web TG          api TG
      │               │
  ECS Fargate     ECS Fargate
  service: web    service: api
  container:web   container:api
                  sidecar: ADOT (X-Ray UDP 2000)
                  │
                  ├── stdout → awslogs → /ecs/christina-crm/api
                  ├── SSM → /medical-crm/${env}/*   (at boot)
                  ├── RDS Postgres                   (VPC)
                  ├── S3 medical-crm-docs            (VPC endpoint)
                  └── KMS alias/medical-crm          (decrypt)
```

## Pipeline (GH Actions)

Workflow: `.github/workflows/deploy.yml`. Triggers on `push` to `main` and
`workflow_dispatch`.

Matrix: `[web, api]`. Per service:
1. Checkout, install, lint, typecheck.
2. OIDC assume `arn:aws:iam::${AWS_ACCOUNT_ID}:role/gha-deploy`.
3. ECR login.
4. `docker/build-push-action@v5` — build with the service Dockerfile,
   push two tags (`:${sha}` + `:latest`). GHA cache keyed by service.
5. `amazon-ecs-render-task-definition@v1` — swap image URI in
   `infra/ecs/task-def-${service}.json`.
6. `amazon-ecs-deploy-task-definition@v1` — force new deployment, wait
   for service stability.

## Dockerfiles

Both multi-stage, `node:20.18.1-alpine`, pnpm via corepack. Non-root user.
Standalone output for the web service, tsc dist/ for the api service. See
`apps/web/Dockerfile` and `apps/api/Dockerfile`.

## Secrets

Not injected at deploy time. The container's IAM role grants
`ssm:GetParametersByPath` + `kms:Decrypt` scoped to `/medical-crm/${env}/*`.
Bootstrap code in `apps/api/src/bootstrap.ts` merges SSM into
`process.env` before the server binds to the port. See `docs/SECRETS.md`.

## Task definition skeleton (Phase B to finalize)

`infra/ecs/task-def-api.json` (sketch):
```jsonc
{
  "family": "christina-crm-api",
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "requiresCompatibilities": ["FARGATE"],
  "executionRoleArn": "arn:aws:iam::...:role/ecs-task-execution",
  "taskRoleArn": "arn:aws:iam::...:role/christina-crm-api-task",
  "containerDefinitions": [
    {
      "name": "christina-crm-api",
      "image": "<set-by-render-step>",
      "portMappings": [{ "containerPort": 3001 }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "APP_ENV",  "value": "prd" },
        { "name": "AWS_REGION", "value": "us-west-1" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/christina-crm/api",
          "awslogs-region": "us-west-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    },
    {
      "name": "adot-collector",
      "image": "public.ecr.aws/aws-observability/aws-otel-collector:latest",
      "portMappings": [{ "containerPort": 2000, "protocol": "udp" }]
    }
  ]
}
```

## Rollback

- `aws ecs update-service --force-new-deployment --task-definition ${previous-revision}` — re-deploy the previous task definition revision.
- Previous container image stays in ECR (lifecycle policy keeps 20 tags).

## Cost notes
- ALB ~$18/mo (fixed).
- Fargate 256 CPU / 512 MB × 2 services × 24h = ~$15/mo.
- CloudFront ~$1-5/mo at pilot traffic.
- CloudWatch Logs ~$5-20/mo.
- RDS t4g.micro ~$16/mo.
- Floor ~$60-100/mo total. See `AWS-ONLY-MIGRATION.md`.

## Smoke checklist (first deploy)

- [ ] ECS service reaches STEADY state.
- [ ] ALB target group shows both tasks healthy.
- [ ] CloudWatch Logs group receives the `API running` line from bootstrap.
- [ ] X-Ray trace map shows web → api edge on a synthetic sign-in.
- [ ] `/v1/me` responds 401 without session cookie, 200 with one.
- [ ] CloudTrail captured the container's `GetParametersByPath` event.
- [ ] SSM audit: no `[REDACTED]` annotations on a clean trace (scrubber
      should only fire on PHI-shaped values, not clean ones).
