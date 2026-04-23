# @christina-crm/observability

Phase 0.6 (AWS-only migration) — CloudWatch + X-Ray observability with PHI
scrubbing for the Christina CRM.

## What this package gives you

- **`tracer`** — AWS X-Ray APM initialization with HIPAA-compliant defaults
  (query-string stripping, `pg` parameter capture off, `http` / `https`
  instrumented globally, UDP daemon default).
- **`logger`** / **`createLogger()`** — pino logger where every log line is
  scrubbed for PHI before serialization. JSON on stdout → CloudWatch Logs
  via the ECS task awslogs driver.
- **`scrubPHI()`** — standalone redaction function. Idempotent, cycle-safe,
  depth-bounded.
- **`metrics`** — CloudWatch Embedded Metric Format (EMF) emitter
  (`increment`, `distribution`, `gauge`). Writes JSON lines to stdout; the
  CloudWatch Logs agent promotes them to CloudWatch Metrics. No AWS SDK
  dependency in the hot path.

## Rules of use (non-negotiable)

### 1. Tracer must be the first import

`aws-xray-sdk-core` patches Node core modules (`https`, `http`) and the `pg`
driver at call time. Anything imported before the tracer is **not**
instrumented — calls will still succeed but won't show up in X-Ray traces.

In an app entry file:

```ts
import './tracer';            // or `@christina-crm/observability/tracer`
import { Hono } from 'hono';  // AFTER tracer only
// … rest of bootstrap
```

Do not put `import './tracer'` behind a helper function, a factory, or a
conditional — it must be the top of the entry file.

### 2. Never call `console.log`/`warn`/`error` in `apps/**`

Use `logger` from this package. ESLint (`no-console: error`, scope
`apps/**`) will fail the build otherwise. Tests and scripts are exempt.

### 3. Frontend RUM is deferred

Datadog RUM was removed in the AWS-only migration. CloudWatch RUM is the
intended replacement but is deferred until pilot signing — no browser
telemetry ships today. Server-side traces (X-Ray) + page-level metrics
(CloudWatch standard) cover the gap.

### 4. No PHI literals in source

The `save.sh` PHI guard blocks obvious patterns (SSN, phone). If a test
needs PHI-shaped input, construct it at runtime (`['123','45','6789'].join('-')`).
See `src/scrubber.test.ts` for examples.

## What gets redacted

**Field names** (case-insensitive): names, MRNs, DOBs, SSNs, MBIs, member
IDs, subscriber IDs, policy numbers, dates of service, addresses. Full
list in `src/scrubber.ts`.

**String patterns**: SSN (`NNN-NN-NNNN`), US phone, Medicare MBI, card-shape
(16 digits), NPI (10-digit starting 1/2), DOB (`YYYY-MM-DD`), MRN-shape
(9–12 char uppercase alphanumeric).

**Query strings**: stripped from X-Ray segment URLs via a `Segment.close`
hook; internal API query params (`?mrn=…`) never reach CloudWatch.

**Postgres parameters**: `capturePostgres` default does not capture bound
parameters as segment metadata. We rely on the SDK default rather than
enabling `AWS_XRAY_COLLECT_SQL_QUERIES`, which would serialize literal SQL
including values.

**Belt-and-suspenders**: CloudWatch Logs subscription filter pattern runs
on top of the scrubber as the server-side safety net. See
`Plans/phase-0-foundation/0.6-cloudwatch-xray.md` for the exact filter to
configure on the log group.

## What does NOT get redacted

- Numbers, booleans, null — not strings
- Strings that don't match any pattern (`"referral created"`)
- Field names not on the list (add them; don't rely on pattern fallback)

If you need to add a field, edit `PHI_FIELDS` in `src/scrubber.ts` and add
a test case.

## Metrics cost note

EMF emissions land in CloudWatch Logs first, then CloudWatch Metrics. Keep
dimension cardinality low: `service` + `env` + one or two business tags
is fine; per-user or per-request-id dimensions will explode the bill.
