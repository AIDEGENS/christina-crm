# apps/api/Dockerfile
#
# Phase 0.6 (AWS-only migration) — Hono API image for ECS Fargate.
#
# Multi-stage build:
#   1. base     — pinned node:20 alpine + pnpm.
#   2. deps     — copy lockfile + manifests, pnpm fetch to prime the store.
#   3. build    — copy full source, install, `pnpm turbo build` scoped to
#                 @christina-crm/api, which runs `tsc` into dist/.
#   4. runner   — copy dist/ + node_modules (production only). Non-root
#                 user. Runs `node apps/api/dist/index.js` on port 3001.
#
# Secrets: fetched at boot via packages/config/src/secrets.ts (SSM). No
# secret is ever baked into the image.
#
# Observability: awslogs driver on the ECS task captures stdout → CloudWatch
# Logs. X-Ray UDP goes to 127.0.0.1:2000 (the ADOT sidecar in the same task).

ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=9.15.0

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/observability/package.json packages/observability/
RUN pnpm fetch

# ---------- build ----------
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm turbo build --filter=@christina-crm/api

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 hono

# Copy the built output and the resolved pnpm-deployed node_modules.
COPY --from=build --chown=hono:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=hono:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=hono:nodejs /app/packages ./packages

USER hono
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
