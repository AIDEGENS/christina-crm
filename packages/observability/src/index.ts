/**
 * packages/observability/src/index.ts
 *
 * Phase 0.6 — public surface for @christina-crm/observability.
 *
 * Import order rule: app entry files should `import '@christina-crm/observability/tracer'`
 * (or a local `./tracer` that re-exports it) as the FIRST line, before any
 * other module. aws-xray-sdk-core's captureHTTPsGlobal / capturePostgres
 * mutate core Node modules at call time; anything loaded first is not
 * instrumented.
 */

export { createLogger, logger, scrubbedErrSerializer } from './logger';
export { scrubPHI, type ScrubOptions } from './scrubber';
export { increment, distribution, gauge, metrics, type Tags } from './metrics';
export { initTracer } from './tracer';
