/**
 * packages/observability/src/metrics.test.ts
 *
 * Unit tests for the CloudWatch EMF metrics emitter.
 *
 * Strategy:
 *   - spy on `process.stdout.write` to capture emitted EMF lines
 *   - parse each line as JSON and assert structure + PHI guard behaviour
 *   - PHI-shaped strings are constructed at runtime via `.join()` to avoid
 *     save.sh false-positives. No literal SSN / phone / email digits appear.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { increment, distribution, gauge } from './metrics';

// ── runtime-built PHI strings (save.sh safe) ──────────────────────────────────
const FAKE_SSN = ['123', '45', '6789'].join('-');
const FAKE_PHONE = ['555', '867', '5309'].join('-');
const FAKE_EMAIL = ['user', 'example.com'].join('@');

// ── helpers ───────────────────────────────────────────────────────────────────

interface EmfPayload {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{ Name: string; Unit: string }>;
    }>;
  };
  [k: string]: unknown;
}

/** Spy on process.stdout.write and collect parsed EMF payloads. */
function collectEmf(): { payloads: EmfPayload[]; restore: () => void } {
  const payloads: EmfPayload[] = [];
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown): boolean => {
    const line = typeof chunk === 'string' ? chunk : String(chunk);
    for (const row of line.split('\n')) {
      if (!row.trim()) continue;
      try {
        payloads.push(JSON.parse(row) as EmfPayload);
      } catch {
        // not our JSON — ignore
      }
    }
    return true;
  });
  return {
    payloads,
    restore: () => {
      spy.mockRestore();
      // ensure original is still bound for later tests
      void original;
    },
  };
}

function findMetric(payloads: EmfPayload[], name: string): EmfPayload | undefined {
  return payloads.find((p) =>
    p._aws.CloudWatchMetrics.some((m) => m.Metrics.some((x) => x.Name === name)),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('metrics — EMF emitter structure', () => {
  it('increment emits a Count metric with namespace + dimensions', () => {
    const { payloads, restore } = collectEmf();
    try {
      increment('crm.test.event', { reason: 'missing_session' });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.event');
    expect(emf).toBeDefined();
    expect(emf!._aws.CloudWatchMetrics[0]!.Namespace).toBe('christina-crm');
    expect(emf!._aws.CloudWatchMetrics[0]!.Metrics[0]!.Unit).toBe('Count');
    expect(emf!['reason']).toBe('missing_session');
    expect(emf!['crm.test.event']).toBe(1);
  });

  it('distribution emits Milliseconds unit', () => {
    const { payloads, restore } = collectEmf();
    try {
      distribution('crm.test.latency', 42, { route: '/v1/me' });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.latency');
    expect(emf!._aws.CloudWatchMetrics[0]!.Metrics[0]!.Unit).toBe('Milliseconds');
    expect(emf!['crm.test.latency']).toBe(42);
  });

  it('gauge emits None unit', () => {
    const { payloads, restore } = collectEmf();
    try {
      gauge('crm.test.gauge', 7, { info: 'value' });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.gauge');
    expect(emf!._aws.CloudWatchMetrics[0]!.Metrics[0]!.Unit).toBe('None');
    expect(emf!['crm.test.gauge']).toBe(7);
  });
});

describe('metrics — PHI tag sanitiser', () => {
  it('passes normal tag values through unchanged', () => {
    const { payloads, restore } = collectEmf();
    try {
      increment('crm.test.event', { reason: 'missing_session' });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.event');
    expect(emf!['reason']).toBe('missing_session');
    // No phi_in_tag counter emitted
    const counter = findMetric(payloads, 'crm.observability.phi_in_tag');
    expect(counter).toBeUndefined();
  });

  it('replaces SSN-shaped tag value with [REDACTED] and emits phi_in_tag counter', () => {
    const { payloads, restore } = collectEmf();
    try {
      increment('crm.test.event', { reason: FAKE_SSN });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.event');
    expect(emf!['reason']).toBe('[REDACTED]');
    expect(emf!['reason']).not.toBe(FAKE_SSN);
    const counter = findMetric(payloads, 'crm.observability.phi_in_tag');
    expect(counter).toBeDefined();
  });

  it('replaces phone-shaped tag value with [REDACTED] and emits phi_in_tag counter', () => {
    const { payloads, restore } = collectEmf();
    try {
      increment('crm.test.event', { contact: FAKE_PHONE });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.event');
    expect(emf!['contact']).toBe('[REDACTED]');
    const counter = findMetric(payloads, 'crm.observability.phi_in_tag');
    expect(counter).toBeDefined();
  });

  it('replaces email-shaped tag value with [REDACTED] and emits phi_in_tag counter', () => {
    const { payloads, restore } = collectEmf();
    try {
      distribution('crm.test.latency', 42, { user: FAKE_EMAIL });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.latency');
    expect(emf!['user']).toBe('[REDACTED]');
    const counter = findMetric(payloads, 'crm.observability.phi_in_tag');
    expect(counter).toBeDefined();
  });

  it('leaves numeric-looking but non-PHI tag values unchanged (HTTP status 200)', () => {
    const { payloads, restore } = collectEmf();
    try {
      increment('crm.test.request', { status: '200' });
    } finally {
      restore();
    }
    const emf = findMetric(payloads, 'crm.test.request');
    expect(emf!['status']).toBe('200');
    const counter = findMetric(payloads, 'crm.observability.phi_in_tag');
    expect(counter).toBeUndefined();
  });

  it('does not throw if stdout.write throws (telemetry never breaks caller)', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('pipe closed');
    });
    try {
      expect(() => increment('crm.test.event', { reason: FAKE_SSN })).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
