/**
 * packages/observability/src/tracer.ts
 *
 * Phase 0.6 (AWS-only migration) — AWS X-Ray APM initialization.
 *
 * CRITICAL: the file that wants tracing must import THIS module before any
 * other application module (including `hono`, `pino`, drizzle, etc). The
 * X-Ray SDK's `captureHTTPsGlobal` monkey-patches the `https` / `http`
 * modules at call time — anything already loaded from the in-memory require
 * cache will NOT be instrumented. Postgres auto-capture was dropped in the
 * AWS-only migration (lives in `aws-xray-sdk-postgres` subpackage now);
 * instrument at the API-layer drizzle/pg middleware if needed.
 *
 * Guarded against `NODE_ENV=test` so unit test suites do not initialize the
 * X-Ray daemon client or open background tasks.
 *
 * HIPAA posture:
 *   - Query strings are stripped from segment URLs via a sampling/streaming
 *     hook (see `sanitizeSegment`). Query params commonly carry PHI-like
 *     data (mrn=..., email=...) in internal API calls.
 *   - Postgres parameter capture is not configured here (postgres patcher
 *     moved out of `aws-xray-sdk-core` in v3.x); API-layer instrumentation
 *     must opt-out of param capture explicitly.
 *   - Default sampling rules stay at the SDK default (reservoir=1, rate=5%);
 *     raise via `AWS_XRAY_SAMPLING_RULES_FILE` if needed, never lower from
 *     code so we keep traceability in incident review.
 *
 * X-Ray daemon / OTLP bridge: the AWS Distro for OpenTelemetry (ADOT)
 * collector sidecar runs on the ECS task and receives UDP on 127.0.0.1:2000.
 * No extra config needed here — the SDK defaults to that endpoint.
 */

import AWSXRay from 'aws-xray-sdk-core';
import https from 'node:https';
import http from 'node:http';

let initialized = false;

/**
 * Strip query string from an X-Ray segment's `http.request.url` field.
 * X-Ray SDK exposes segment objects via `AWSXRay.getSegment()`; we can also
 * mutate the segment from `Segment.prototype.addRemoteRequestData` by
 * wrapping the outgoing http capture.
 */
function stripQueryFromUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/**
 * X-Ray hook — rewrites http request/response data on every segment so URLs
 * lose their query string and a synthetic `http.query.string` annotation
 * records only the redacted marker.
 *
 * The SDK exposes `AWSXRay.setContextMissingStrategy` and a low-level
 * `Segment.addAnnotation` API; we hook at the `setStreamingThreshold` path
 * so every segment is post-processed.
 */
function installQueryStringRedaction(): void {
  // Patch the segment emit path. `Segment.prototype.close` is the last chance
  // to mutate before serialization — we reach it via the SDK's Segment class.
  // Using `any` here because the SDK types don't export the Segment class
  // constructor directly from the public surface.
  const Segment = (AWSXRay as unknown as { Segment: { prototype: Record<string, unknown> } }).Segment;
  if (!Segment || typeof Segment.prototype !== 'object') return;

  const proto = Segment.prototype as unknown as {
    close: (...args: unknown[]) => unknown;
    http?: { request?: { url?: string } };
  };
  const originalClose = proto.close;
  if (typeof originalClose !== 'function') return;

  proto.close = function patchedClose(this: unknown, ...args: unknown[]): unknown {
    const self = this as {
      http?: { request?: { url?: string } };
      addAnnotation?: (k: string, v: string) => void;
    };
    try {
      if (self.http?.request) {
        const original = self.http.request.url;
        const stripped = stripQueryFromUrl(original);
        if (stripped !== original && typeof stripped === 'string') {
          self.http.request.url = stripped;
          if (typeof self.addAnnotation === 'function') {
            self.addAnnotation('http_query_string', '[REDACTED]');
          }
        }
      }
    } catch {
      // never break the segment close path — telemetry is non-load-bearing
    }
    return originalClose.apply(this, args);
  };
}

export function initTracer(): typeof AWSXRay {
  if (initialized) {
    return AWSXRay;
  }
  if (process.env['NODE_ENV'] === 'test') {
    initialized = true;
    return AWSXRay;
  }

  // Default service segment name. ECS task defs can override via
  // `AWS_XRAY_TRACING_NAME`, but we set a fallback here so local dev is sane.
  AWSXRay.setDaemonAddress(process.env['AWS_XRAY_DAEMON_ADDRESS'] ?? '127.0.0.1:2000');

  // Instrument outgoing HTTPS + HTTP calls. captureHTTPsGlobal mutates the
  // required `https` / `http` module exports in place — it MUST run before
  // anything else imports hono / node-fetch / drizzle, or those clients
  // will hold a reference to the un-patched `request` / `get` functions.
  try {
    AWSXRay.captureHTTPsGlobal(https);
    AWSXRay.captureHTTPsGlobal(http);
  } catch {
    // SDK refuses to double-patch; treat as harmless.
  }

  // Postgres auto-instrumentation DROPPED in AWS-only migration: `capturePostgres`
  // was removed from `aws-xray-sdk-core@3.x` and now ships in the separate
  // `aws-xray-sdk-postgres` subpackage (or via the `aws-xray-sdk` meta package).
  // Rather than pull another runtime dep into the observability package, we
  // instrument Postgres at the API-layer drizzle/pg middleware when the API
  // package needs query-level tracing. Bound parameters stay scrubbed at the
  // log-line boundary (see scrubber.ts) so PHI never lands in a segment even
  // without pg instrumentation.
  // TODO(post-launch): add `aws-xray-sdk-postgres` dep + re-enable here if
  // query-level tracing becomes load-bearing for incident review.

  installQueryStringRedaction();

  initialized = true;
  return AWSXRay;
}

// Auto-init on import so consumers only have to `import './tracer'` once as
// the very first line of their entry file. Tests hitting NODE_ENV=test skip.
initTracer();

export default AWSXRay;
