# apps/web/Dockerfile
#
# Phase 0.6 (AWS-only migration) — Next.js 15 standalone image for ECS Fargate.
#
# Multi-stage build:
#   1. base     — pinned node:20 alpine + pnpm.
#   2. deps     — copy lockfile + manifests, pnpm fetch to prime the store.
#   3. build    — copy full source, pnpm install --offline, `pnpm turbo build`
#                 scoped to @christina-crm/web. `output: 'standalone'` in
#                 next.config.ts produces a self-contained .next/standalone
#                 with its own minimal node_modules.
#   4. runner   — copy .next/standalone + .next/static + public. Non-root
#                 user. Runs `node server.js` on port 3000.
#
# Health check: ECS ALB target group hits `/` with a 10s timeout. Next.js
# 15 standalone responds to `/` immediately after boot; no custom probe
# endpoint is needed at this stage.

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
COPY apps/web/package.json apps/web/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/observability/package.json packages/observability/
COPY packages/ui/package.json packages/ui/
RUN pnpm fetch

# ---------- build ----------
FROM base AS build
COPY --from=deps /app ./
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm turbo build --filter=@christina-crm/web

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user. Next.js standalone writes nothing at runtime.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone output + static assets + public.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
