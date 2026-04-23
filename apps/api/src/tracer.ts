/**
 * apps/api/src/tracer.ts
 *
 * Phase 0.6 (AWS-only migration) — X-Ray bootstrap for the Hono API.
 *
 * This file MUST be imported BEFORE any other module in the entry file.
 * The shared observability package does the real work; this file exists so
 * the app can `import './tracer'` as the literal first line without pulling
 * in the package barrel (which would transitively load pino/scrubber/etc).
 */

import '@christina-crm/observability/tracer';

export {};
