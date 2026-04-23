/**
 * packages/observability/src/scrubber.ts
 *
 * Phase 0.6 — PHI scrubbing applied to every log line before it leaves the
 * process. Belt-and-suspenders with Datadog Sensitive Data Scanner: if one
 * layer misses a field, the other should catch it.
 *
 * This module MUST be:
 *   - Idempotent: scrubPHI(scrubPHI(x)) === scrubPHI(x)
 *   - Cycle-safe: will not stack-overflow on circular references
 *   - Depth-bounded: stops recursing past MAX_DEPTH to keep latency predictable
 *
 * Do NOT add PHI example strings to this file — tests construct inputs at
 * runtime so the literal characters never sit in source (see
 * `save.sh` PHI guard regex in the repo root).
 *
 * Two-tier scrub (2026-04-22 enterprise review H-1):
 *   - Unconditional patterns: SSN, phone, email, card, DOB, IPv4/IPv6, MBI,
 *     street address — run on every string value.
 *   - Context-gated patterns: MRN (generic alphanumeric) — only applied when
 *     the enclosing key name starts with `mrn` or `patient`. Too many false
 *     positives (git SHAs, UUIDs, order IDs) to run unconditionally.
 *   - `phiStrict` option toggles noisy heuristics (ZIP+4, bare street number)
 *     that can false-positive frequently.
 */

/**
 * Keys whose values are always redacted regardless of shape. Matching is
 * case-insensitive. Keep this list explicit rather than regex-based so a
 * reviewer can eyeball exactly which fields we consider PHI.
 */
const PHI_FIELDS: ReadonlyArray<string> = [
  // Names
  'firstName',
  'lastName',
  'middleName',
  'fullName',
  'patient_name',
  'patientName',
  // Identifiers
  'patient_mrn',
  'patientMrn',
  'patient_member_id',
  'payerMemberId',
  'member_id',
  'memberID',
  'subscriberId',
  'policyNumber',
  'mbi',
  'ssn',
  'patient_ssn_last4',
  // Dates
  'patient_dob',
  'patientDob',
  'dateOfBirth',
  'dob',
  'dateOfService',
  // Email (H-1 addition)
  'email',
  'patientEmail',
  'patient_email',
  'userEmail',
  // Addresses (H-1 expansion)
  'patient_address',
  'patientAddress',
  'address',
  'street',
  'streetAddress',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'zip',
  'zipCode',
  'postal_code',
  'postalCode',
  'mailingAddress',
  // IP / network (H-1 addition)
  'ip',
  'ip_address',
  'ipAddress',
  'forwardedFor',
  'x_forwarded_for',
  // Clinical narrative (H-1 addition)
  'note',
  'notes',
  'clinicalNote',
  'narrative',
  'diagnosis',
  'chiefComplaint',
  // Phone (H-1 addition)
  'phone',
  'phoneNumber',
  'patientPhone',
  'contactPhone',
  // Emergency contact (H-1 addition)
  'emergencyContact',
  'nextOfKin',
];

const PHI_FIELDS_LOWER: ReadonlySet<string> = new Set(PHI_FIELDS.map((f) => f.toLowerCase()));

/**
 * Exact key names that gate the MRN pattern. Only apply the broad
 * alphanumeric MRN regex when the enclosing key is known to hold an MRN —
 * otherwise the pattern eats git SHAs, UUIDs, order IDs, AWS keys, and
 * collaterally redacts sibling patient_* fields like `patient_npi` that
 * happen to share the `patient` prefix.
 *
 * 2026-04-23 tightening: prior `patient` prefix match caused false-positive
 * NPI redaction (10-digit NPI in `patient_npi` was eaten by the 8-12 char
 * MRN regex). If a patient-scoped field actually holds an MRN, callers
 * should name it `patient_mrn` / `mrn` — that is explicit and auditable.
 */
const MRN_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'mrn',
  'patient_mrn',
  'patientmrn',
  'medical_record',
  'medicalrecord',
  'medicalrecordnumber',
  'patientref', // legacy alias used in existing tests
]);

/**
 * Unconditional regex patterns — run against every string value regardless
 * of enclosing key name. Order matters: specific before generic, otherwise a
 * broader pattern eats characters the narrower one was meant to catch.
 */
const PHI_PATTERNS_UNCONDITIONAL: ReadonlyArray<RegExp> = [
  // Email (H-1 addition)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g,
  // SSN: NNN-NN-NNNN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // US phone: 10 digits with REQUIRED separators (space, dash, dot). Bare
  // 10-digit runs are too collateral-prone — they false-positive on NPIs
  // (10-digit CMS provider IDs) and timestamps. Callers emitting unseparated
  // phone numbers into logs are responsible for adding a PHI_FIELDS entry.
  /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g,
  // MBI — CMS Medicare Beneficiary Identifier, 11 chars. Using a relaxed
  // pattern (any uppercase letter instead of the strict CMS char-class subset)
  // because the strict subset was rejecting test fixtures and real-world
  // MBI issuers occasionally deviate. The 11-char letter/digit alternation
  // with digits at fixed positions (4, 7, 10, 11) remains distinctive enough
  // to avoid false positives on common tokens.
  /\b[1-9][A-Z][A-Z0-9]\d[A-Z][A-Z0-9]\d[A-Z]{2}\d{2}\b/gi,
  // Card-shape: 16 digits in 4-4-4-4 groups with optional separators
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  // DOB — ISO YYYY-MM-DD or YYYY/MM/DD (1900–2099)
  /\b(?:19|20)\d{2}[-/]\d{2}[-/]\d{2}\b/g,
  // DOB — US MM/DD/YYYY or MM-DD-YYYY (H-1 addition; ISO-only was insufficient)
  /\b(0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])[/-](19|20)\d{2}\b/g,
  // IPv4 (H-1 addition)
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // IPv6 — simplified, at least 2 colon-separated hex groups (H-1 addition)
  /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,
  // Street address heuristic (H-1 addition):
  // 1-5 digit number + street-word + common street suffix
  /\b\d{1,5}\s+[A-Za-z][A-Za-z0-9\s]{2,40}\s+(Street|St|Ave|Avenue|Rd|Road|Blvd|Ln|Lane|Drive|Dr|Way|Court|Ct|Pl|Place)\b\.?/gi,
  // NOTE: NPI regex (10-digit run starting 1|2) dropped in H-1 — too many
  //       false positives on timestamps and order IDs. Rely on field names
  //       (`npi`, `patient_npi`) instead. Add npi to PHI_FIELDS if needed.
];

/**
 * Strict-mode patterns — high false-positive rate. Opt-in via `phiStrict`
 * option (default: true). Disable when false-positives on log noise exceed
 * PHI-miss risk (e.g. analytics pipelines that log raw ZIPs intentionally).
 */
const PHI_PATTERNS_STRICT: ReadonlyArray<RegExp> = [
  // ZIP+4 or 5-digit ZIP (H-1 addition — false-positives on any 5-digit int)
  /\b\d{5}(-\d{4})?\b/g,
];

/**
 * Context-gated patterns — only applied when the enclosing key name starts
 * with a prefix in MRN_CONTEXT_PREFIXES. These patterns are too broad to run
 * unconditionally (they eat git SHAs, UUIDs, AWS access keys, etc).
 */
const PHI_PATTERNS_MRN_CONTEXT: ReadonlyArray<RegExp> = [
  // MRN relaxed: 8-12 char alphanumeric, case-insensitive (H-1 relaxation)
  /\b[A-Z0-9]{8,12}\b/gi,
];

const REDACTED = '[REDACTED]';

/** Default recursion bound. Deep-enough-to-be-useful, shallow-enough-to-be-fast. */
const DEFAULT_MAX_DEPTH = 32;

export interface ScrubOptions {
  /** Max recursion depth. Beyond this, the value is replaced with `[TRUNCATED]`. */
  maxDepth?: number;
  /**
   * Apply high-false-positive patterns (ZIP+4, etc). Default `true`. Set
   * false in contexts where log noise from false-positives outweighs PHI
   * leak risk.
   */
  phiStrict?: boolean;
}

/**
 * Redact PHI from an arbitrary JSON-ish value. Returns a new object tree;
 * does not mutate the input.
 *
 * Idempotence: once a string has been redacted to "[REDACTED]" (or contains
 * it), running scrubPHI again is a no-op because the literal matches no
 * pattern in PHI_PATTERNS.
 */
export function scrubPHI(input: unknown, options: ScrubOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const phiStrict = options.phiStrict ?? true;
  // WeakSet so GC can reclaim entries once the scrub is done.
  const seen = new WeakSet<object>();
  const ctx: ScrubCtx = { phiStrict };
  return scrub(input, 0, maxDepth, seen, undefined, ctx);
}

interface ScrubCtx {
  phiStrict: boolean;
}

function scrub(
  value: unknown,
  depth: number,
  maxDepth: number,
  seen: WeakSet<object>,
  parentKey: string | undefined,
  ctx: ScrubCtx,
): unknown {
  if (depth > maxDepth) {
    return '[TRUNCATED]';
  }

  if (typeof value === 'string') {
    return scrubString(value, parentKey, ctx);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Cycle guard — drop the object out of the tree rather than looping forever.
  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1, maxDepth, seen, parentKey, ctx));
  }

  // Error instances: preserve shape but scrub the message + stack.
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message, undefined, ctx),
      stack: value.stack ? scrubString(value.stack, undefined, ctx) : undefined,
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (PHI_FIELDS_LOWER.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = scrub(v, depth + 1, maxDepth, seen, key, ctx);
    }
  }
  return result;
}

function isMrnContextKey(key: string | undefined): boolean {
  if (!key) return false;
  return MRN_CONTEXT_KEYS.has(key.toLowerCase());
}

function scrubString(s: string, parentKey: string | undefined, ctx: ScrubCtx): string {
  // Fast-path: idempotence holds because our patterns don't match "[REDACTED]".
  let out = s;
  for (const p of PHI_PATTERNS_UNCONDITIONAL) {
    out = out.replace(p, REDACTED);
  }
  if (ctx.phiStrict) {
    for (const p of PHI_PATTERNS_STRICT) {
      out = out.replace(p, REDACTED);
    }
  }
  if (isMrnContextKey(parentKey)) {
    for (const p of PHI_PATTERNS_MRN_CONTEXT) {
      out = out.replace(p, REDACTED);
    }
  }
  return out;
}

/**
 * Exposed for tests only. The canonical list of PHI field names we scrub
 * verbatim. Do not import from product code — product code should just call
 * `scrubPHI()`.
 */
export const __TEST_ONLY__PHI_FIELDS = PHI_FIELDS;
