/**
 * packages/observability/src/metrics.ts
 *
 * Phase 0.6 (AWS-only migration) — CloudWatch Embedded Metric Format (EMF)
 * emitter.
 *
 * EMF lets the CloudWatch Logs agent extract structured metrics from a
 * single JSON line on stdout. Zero AWS SDK dependency — we just write to
 * `process.stdout` and the awslogs driver on the ECS task definition ships
 * it to CloudWatch, where a log-metric filter (or the native EMF parser)
 * promotes the values into CloudWatch Metrics.
 *
 * Spec: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 *
 * Shape emitted (example):
 * {
 *   "_aws": {
 *     "Timestamp": 1745000000000,
 *     "CloudWatchMetrics": [{
 *       "Namespace": "christina-crm",
 *       "Dimensions": [["service","env"]],
 *       "Metrics": [{ "Name": "crm.http.request", "Unit": "Count" }]
 *     }]
 *   },
 *   "service": "crm-api",
 *   "env": "production",
 *   "crm.http.request": 1,
 *   "route": "/v1/me"
 * }
 *
 * H-9/M3 — tag value type narrowed to `string` only (was string|number|boolean).
 * Numbers and booleans on tag values tend to explode cardinality when callers
 * pass user IDs or "active"-as-flag; forcing string also lets us scan every
 * value for PHI shapes before it goes to CloudWatch.
 *
 * Tag names follow the doctrine from
 * `Plans/phase-0-foundation/0.6-datadog-observability.md` § 8 (ported to
 * `0.6-cloudwatch-xray.md`).
 */

/**
 * Tag values MUST be strings. If a caller has a number/bool, they stringify
 * at the call site — that's a conscious cardinality decision.
 */
export type Tags = Record<string, string>;

/**
 * CloudWatch metric units we use. Full list here:
 * https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_MetricDatum.html
 */
type Unit = 'Count' | 'Milliseconds' | 'Seconds' | 'None';

const NAMESPACE = process.env['CW_METRIC_NAMESPACE'] ?? 'christina-crm';

/**
 * PHI guard — lightweight subset of scrubber.ts patterns, inlined to avoid
 * pulling the scrubber (and its dependencies) into the metrics hot path.
 * If ANY tag value matches these, we replace it with '[REDACTED]' and bump
 * a counter so we can see the guard firing in CloudWatch without leaking the
 * original value anywhere.
 */
const PHI_TAG_PATTERNS: ReadonlyArray<RegExp> = [
  // SSN NNN-NN-NNNN
  /\b\d{3}-\d{2}-\d{4}\b/,
  // US phone, 10 digits with optional separators
  /\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b/,
  // Email shape (good enough for tag scanning; fuller match lives in scrubber)
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
];

const REDACTED_TAG_VALUE = '[REDACTED]';
const PHI_TAG_COUNTER = 'crm.observability.phi_in_tag';

/**
 * Returns a sanitised copy of tags. Any value matching a PHI pattern is
 * replaced with '[REDACTED]'; if at least one replacement happened, we
 * fire a counter so ops can see the guard working.
 */
function sanitiseTags(tags: Tags | undefined): { tags: Tags; dirty: boolean } {
  const out: Tags = {};
  let dirty = false;
  if (!tags) return { tags: out, dirty };
  for (const [k, v] of Object.entries(tags)) {
    const str = typeof v === 'string' ? v : String(v);
    let replaced = str;
    for (const p of PHI_TAG_PATTERNS) {
      if (p.test(replaced)) {
        replaced = REDACTED_TAG_VALUE;
        dirty = true;
        break;
      }
    }
    out[k] = replaced;
  }
  return { tags: out, dirty };
}

/**
 * Base dimensions every metric inherits from env. Keep this list short —
 * CloudWatch charges per unique dimension combination.
 */
function baseDimensions(): Tags {
  return {
    service: process.env['SERVICE_NAME'] ?? 'crm-api',
    env: process.env['NODE_ENV'] ?? 'development',
  };
}

/**
 * Emit a single EMF log line. Called by increment/distribution/gauge below.
 *
 * Callers never await this — stdout.write is sync-enough in Node for our
 * purposes and we never want telemetry to back-pressure request handling.
 */
function emit(name: string, value: number, unit: Unit, tags: Tags | undefined): void {
  try {
    const { tags: sanitised, dirty } = sanitiseTags(tags);
    const dims = { ...baseDimensions(), ...sanitised };
    const dimensionKeys = Object.keys(dims);

    const payload: Record<string, unknown> = {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: NAMESPACE,
            Dimensions: [dimensionKeys],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      ...dims,
      [name]: value,
    };

    process.stdout.write(JSON.stringify(payload) + '\n');

    if (dirty) {
      // Recurse once with no tags so we never re-trigger the dirty path.
      const phiPayload: Record<string, unknown> = {
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [
            {
              Namespace: NAMESPACE,
              Dimensions: [Object.keys(baseDimensions())],
              Metrics: [{ Name: PHI_TAG_COUNTER, Unit: 'Count' as Unit }],
            },
          ],
        },
        ...baseDimensions(),
        [PHI_TAG_COUNTER]: 1,
      };
      process.stdout.write(JSON.stringify(phiPayload) + '\n');
    }
  } catch {
    // swallow — telemetry must never break the caller
  }
}

export function increment(stat: string, tags?: Tags, value = 1): void {
  emit(stat, value, 'Count', tags);
}

export function distribution(stat: string, value: number, tags?: Tags): void {
  // CloudWatch doesn't have a native "distribution" — the EMF parser stores
  // repeated emissions of the same metric name and CloudWatch computes
  // percentiles over the resulting time-series.
  emit(stat, value, 'Milliseconds', tags);
}

export function gauge(stat: string, value: number, tags?: Tags): void {
  emit(stat, value, 'None', tags);
}

export const metrics = { increment, distribution, gauge };
