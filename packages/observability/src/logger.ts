/**
 * packages/observability/src/logger.ts
 *
 * Phase 0.6 — pino logger with mandatory PHI scrubbing.
 *
 * Every log line passes through `scrubPHI()` in the `formatters.log` hook.
 * This means:
 *   - Any object logged as `logger.info({ patient_mrn: "X" }, "msg")` has
 *     PHI-shaped fields redacted BEFORE serialization.
 *   - Strings inside log objects still get pattern-scrubbed (SSN, phone, MBI,
 *     DOB, NPI, card-shape, MRN-shape).
 *   - Headers are NEVER logged — the `req` serializer strips them.
 *
 * Use this logger instead of `console.log` in every app file. ESLint enforces
 * that in `apps/**` via `no-console: error`.
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { scrubPHI } from './scrubber';

/**
 * Wrap pino's stdSerializers.err so Error.message, Error.stack, and every
 * own-enumerable property get PHI-scrubbed before serialization. The default
 * `pino.stdSerializers.err` passes message/stack through unchanged — if a
 * caller throws with PHI in the message (e.g. "failed to find patient X"),
 * that string hits the log stream raw. H-1 review requirement.
 */
export function scrubbedErrSerializer(err: Error): Record<string, unknown> {
  const base = pino.stdSerializers.err(err);
  return scrubPHI(base) as Record<string, unknown>;
}

export interface CreateLoggerOptions {
  /** Service name — shows up as `service` tag in Datadog. */
  service: string;
  /** Deployment env: `development`, `staging`, `production`, `test`. */
  env?: string;
  /** Git SHA of the running code, for trace→source correlation. */
  gitSha?: string;
  /** Pino log level. Defaults to LOG_LEVEL env or `info`. */
  level?: string;
}

/**
 * Build a scoped pino logger. Prefer calling this once per app entry point
 * and passing the result down, rather than calling it repeatedly.
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const config: LoggerOptions = {
    level: opts.level ?? process.env['LOG_LEVEL'] ?? 'info',
    base: {
      service: opts.service,
      env: opts.env ?? process.env['NODE_ENV'] ?? 'development',
      version: opts.gitSha ?? process.env['GIT_SHA'] ?? 'dev',
    },
    formatters: {
      log: (obj) => scrubPHI(obj) as Record<string, unknown>,
    },
    serializers: {
      err: scrubbedErrSerializer,
      // Strip headers explicitly — auth cookies and bearer tokens live there.
      req: (req: { method?: string; url?: string }) => ({
        method: req.method,
        url: req.url,
      }),
    },
    // Redact common nested hotspots as a last-resort safety net. pino's redact
    // runs before formatters, so this is cheap belt-and-suspenders.
    redact: {
      paths: ['*.password', '*.authorization', '*.cookie', 'headers', 'req.headers'],
      censor: '[REDACTED]',
    },
  };

  return pino(config);
}

/** Default shared logger; callers can override per-service via createLogger. */
export const logger: Logger = createLogger({
  service: process.env['DD_SERVICE'] ?? 'crm',
});
