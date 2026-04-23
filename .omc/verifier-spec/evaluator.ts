/**
 * christina-crm-inspect — Verifier Evaluator (v2 draft)
 *
 * Purpose: pure, side-effect-free decision function that routes a CRM referral
 * into one of {PASS, BLOCK, MANUAL_REVIEW} and assigns a downstream pipeline.
 *
 * Architecture (VR-008):
 *   - This module lives inside the separate `christina-crm-inspect` app.
 *   - It consumes a `ReferralInput` projected from `crm.referrals` and emits
 *     an `EvaluationResult` that is persisted to `verification.evaluations`.
 *   - NO cross-schema FKs. `referral_id` is a loose UUID reference to
 *     `crm.referrals.id` only.
 *
 * v2 changes vs v1:
 *   - VR-007 is now OWNED PER-PAYER. Each routeXxx function runs its own
 *     member-id check FIRST and returns MANUAL_REVIEW on miss. There is no
 *     global `checkMemberIdRequired` gate anymore.
 *   - Medicare Advantage is COUNTY-GATED like Medi-Cal MCO. No global MA
 *     auto-pass set; MA plans are stored in a per-county map.
 *   - Rule functions are PURE at every layer: no shared mutable `trace`
 *     array is passed in. Each function returns `{ result, traceEntries }`
 *     and `evaluate()` concatenates.
 *   - VR-009 is FLAG-GATED via `EvaluationContext.vr009Enforced` (default
 *     false). When false, VR-009 skips instead of BLOCKing, allowing intake
 *     to proceed before crm.referrals.county backfill is complete. Set
 *     `vr009Enforced: true` (sourced from VR_009_ENFORCED env var) only
 *     after the gate checklist in crm-migration-add-county.sql passes.
 *
 * Rule coverage:
 *   VR-001 Medicare FFS              -> PASS (owns VR-007/MBI gate)
 *   VR-002 Medi-Cal MCO (county)     -> PASS / MANUAL_REVIEW (owns VR-007)
 *   VR-003 Medicare Advantage (cty)  -> PASS / MANUAL_REVIEW (owns VR-007)
 *   VR-004 Commercial (global)       -> PASS / MANUAL_REVIEW (owns VR-007)
 *   VR-005 Self-Pay                  -> MANUAL_REVIEW (no VR-007 check)
 *   VR-006 Eligibility seam          -> manual MVP, Stedi 270/271 post-MVP
 *   VR-007 Member-ID capture         -> per-payer, not a global gate
 *   VR-008 Separate verifier app     -> architectural constraint
 *   VR-009 County-required global    -> BLOCK before per-payer routing
 *
 * Contract:
 *   - Pure function. No I/O. No globals. No Date.now() (caller injects clock).
 *   - All external data is injected via `EvaluationContext`.
 *   - Unknown plans never throw — they route to MANUAL_REVIEW.
 *   - Pure at every layer; no shared mutable state.
 *   - Always populate `trace` with every rule checked, in order.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PayerType =
  | 'medicare_ffs'
  | 'medi_cal_mco'
  | 'medicare_advantage'
  | 'commercial'
  | 'self_pay';

export type County =
  | 'los_angeles'
  | 'san_bernardino'
  | 'riverside'
  | 'orange'
  | 'san_diego'
  | null;

export type Decision = 'PASS' | 'BLOCK' | 'MANUAL_REVIEW';

export type Pipeline =
  | 'intake'
  | 'eligibility_queue'
  | 'manual_review_queue'
  | 'rejected'
  | null;

export interface ReferralInput {
  /** UUID reference to crm.referrals.id (loose, no FK — VR-008) */
  referral_id: string;
  payer_type: PayerType;
  /** e.g. "Blue Shield Promise"; nullable for FFS / self_pay */
  payer_plan_name: string | null;
  member_id: string | null;
  county: County;
  has_signed_financial_agreement?: boolean;
}

export interface TraceEntry {
  rule: string;
  outcome: string;
}

export interface EvaluationResult {
  decision: Decision;
  pipeline: Pipeline;
  /** machine-readable e.g. 'VR-009_COUNTY_REQUIRED' */
  reason_code: string;
  // NOTE: reason_human strings MUST NEVER interpolate ${input.*}. These surfaces
  // are rendered in UI and exported in audit logs. PHI-safe static strings only.
  // TODO(post-v1): enforce via ESLint rule + unit test.
  /** human-readable, safe for UI surfaces — never contains PHI */
  reason_human: string;
  /** e.g. 'VR-009' */
  rule_fired: string;
  /** true iff the plan_name matched a contracted panel entry */
  payer_matched: boolean;
  /** full rule-evaluation trace, in order */
  trace: TraceEntry[];
}

// Non-null subset of County used to key the county-scoped plan map.
export type NonNullCounty = Exclude<County, null>;

/**
 * Contracted-panel catalog. MVP ships with empty sets — every unknown plan
 * resolves to MANUAL_REVIEW, never crashes. Admin seeds these over time.
 *
 * v2: Medicare Advantage is now per-county like MCO. Commercial remains
 * global (the only payer with a single cross-county contract list).
 */
export interface ContractedPlans {
  medicare_advantage_by_county: Record<NonNullCounty, Set<string>>;
  commercial: Set<string>;
  medi_cal_mco_by_county: Record<NonNullCounty, Set<string>>;
}

/**
 * Async seam for VR-006 eligibility resolution. Unused in MVP; wired to Stedi
 * 270/271 post-MVP. Evaluator DOES NOT await this in v1 — signature only, so
 * that the pure `evaluate()` stays synchronous.
 */
export type EligibilityResolver = (
  payer: PayerType,
  memberId: string,
) => Promise<{
  active: boolean;
  source: 'manual' | 'stedi_270_271';
  coverage_start?: string;     // ISO date
  coverage_end?: string | null; // null = open-ended coverage
  plan_id?: string;
  reason?: string;             // human-readable; MUST be PHI-safe
  raw?: unknown;               // vendor payload, optional, never logged to traces
}>;

export interface EvaluationContext {
  contractedPlans: ContractedPlans;
  /** VR-006 seam; optional in MVP. */
  resolveEligibility?: EligibilityResolver;
  /**
   * VR-009 enforcement flag. When false, VR-009 logs a skip trace entry
   * instead of BLOCKing. Source this from the VR_009_ENFORCED env var
   * (default: false until crm.referrals.county backfill gate passes).
   * See crm-migration-add-county.sql for the gate checklist.
   */
  vr009Enforced: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const COUNTY_REQUIRED_PAYERS: ReadonlySet<PayerType> = new Set<PayerType>([
  'medi_cal_mco',
  'medicare_advantage',
]);

function normalizePlan(name: string | null): string {
  return (name ?? '').trim().toLowerCase();
}

/**
 * Shared VR-007 helper. Returns a fully-formed MANUAL_REVIEW / BLOCK response
 * when `member_id` is missing, or `null` when present. Callers pass the
 * router's reason-code + action so each per-payer router owns its own
 * flavor (FFS/MBI, MCO/member-id, MA/plan-member-id, Commercial/plan-member-id).
 */
function requireMemberIdOr(
  input: ReferralInput,
  missingAction: 'BLOCK' | 'MANUAL_REVIEW',
  ruleId: string,
  reasonCodeMissing: string,
  reasonHumanMissing: string,
): { result: EvaluationResult; traceEntries: TraceEntry[] } | null {
  const present =
    input.member_id !== null && input.member_id.trim() !== '';
  if (present) {
    return null;
  }
  const decision: Decision = missingAction;
  const pipeline: Pipeline =
    missingAction === 'BLOCK' ? 'rejected' : 'manual_review_queue';
  const traceEntries: TraceEntry[] = [
    {
      rule: ruleId,
      outcome: `fire: member_id missing (${missingAction.toLowerCase()})`,
    },
  ];
  return {
    result: {
      decision,
      pipeline,
      reason_code: reasonCodeMissing,
      reason_human: reasonHumanMissing,
      rule_fired: ruleId,
      payer_matched: false,
      trace: [], // evaluate() concatenates
    },
    traceEntries,
  };
}

// ---------------------------------------------------------------------------
// Rule implementations (pure — every function returns its own trace entries)
// ---------------------------------------------------------------------------

/**
 * VR-009 — global county-required pre-check.
 * Fires BEFORE any per-payer routing. Enforcement is flag-gated via
 * `ctx.vr009Enforced`; when false, emits a skip trace and returns null so
 * per-payer routing continues. When true, BLOCKs on missing county.
 */
function checkCountyRequired(
  input: ReferralInput,
  ctx: EvaluationContext,
): { result: EvaluationResult | null; traceEntries: TraceEntry[] } {
  if (!ctx.vr009Enforced) {
    return {
      result: null,
      traceEntries: [
        { rule: 'VR-009', outcome: 'skip: enforcement disabled via vr009Enforced=false' },
      ],
    };
  }
  if (!COUNTY_REQUIRED_PAYERS.has(input.payer_type)) {
    return {
      result: null,
      traceEntries: [
        { rule: 'VR-009', outcome: 'skip: payer_type does not require county' },
      ],
    };
  }
  if (input.county === null) {
    return {
      result: {
        decision: 'BLOCK',
        pipeline: 'rejected',
        reason_code: 'VR-009_COUNTY_REQUIRED',
        reason_human:
          'County is required for Medi-Cal MCO and Medicare Advantage referrals. Intake must backfill county before routing.',
        rule_fired: 'VR-009',
        payer_matched: false,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-009', outcome: 'fire: county is NULL for county-required payer' },
      ],
    };
  }
  return {
    result: null,
    traceEntries: [{ rule: 'VR-009', outcome: 'pass: county present' }],
  };
}

/** VR-001 — Medicare FFS → PASS (MAC TBD, no panel gate). Owns MBI check. */
function routeMedicareFfs(
  input: ReferralInput,
): { result: EvaluationResult; traceEntries: TraceEntry[] } {
  const mbiGate = requireMemberIdOr(
    input,
    'MANUAL_REVIEW',
    'VR-001',
    'VR-007_FFS_MBI_MISSING_MANUAL',
    'Medicare FFS requires an MBI before auto-pass. Intake may arrive before MBI capture — route to manual review to collect the MBI, then re-evaluate.',
  );
  if (mbiGate !== null) {
    return mbiGate;
  }
  return {
    result: {
      decision: 'PASS',
      pipeline: 'intake',
      reason_code: 'VR-001_MEDICARE_FFS_PASS',
      reason_human:
        'Medicare FFS referrals pass automatically. MAC jurisdiction TBD; no contracted-panel gate applies.',
      rule_fired: 'VR-001',
      payer_matched: true,
      trace: [],
    },
    traceEntries: [
      { rule: 'VR-001', outcome: 'pass: MBI present; Medicare FFS auto-pass' },
    ],
  };
}

/** VR-002 — Medi-Cal MCO, county-gated panel lookup. Owns member-id check. */
function routeMediCalMco(
  input: ReferralInput,
  ctx: EvaluationContext,
): { result: EvaluationResult; traceEntries: TraceEntry[] } {
  const memberGate = requireMemberIdOr(
    input,
    'MANUAL_REVIEW',
    'VR-002',
    'VR-007_MCO_MEMBER_ID_MISSING_MANUAL',
    'Medi-Cal MCO referral is missing a plan member ID. Route to manual review to capture the member ID, then re-evaluate.',
  );
  if (memberGate !== null) {
    return memberGate;
  }

  // VR-009 already guaranteed non-null county for this payer; narrow defensively.
  if (input.county === null) {
    return {
      result: {
        decision: 'BLOCK',
        pipeline: 'rejected',
        reason_code: 'VR-002_COUNTY_MISSING',
        reason_human: 'Medi-Cal MCO requires county; none provided.',
        rule_fired: 'VR-002',
        payer_matched: false,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-002', outcome: 'defensive: county null bypassed VR-009?' },
      ],
    };
  }

  const plansInCounty =
    ctx.contractedPlans.medi_cal_mco_by_county[input.county] ?? new Set<string>();
  const plan = normalizePlan(input.payer_plan_name);
  const matched = plan !== '' && plansInCounty.has(plan);

  if (matched) {
    return {
      result: {
        decision: 'PASS',
        pipeline: 'eligibility_queue',
        reason_code: 'VR-002_MCO_IN_PANEL',
        reason_human: 'Medi-Cal MCO plan is contracted for the referral county.',
        rule_fired: 'VR-002',
        payer_matched: true,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-002', outcome: `pass: plan in-panel for ${input.county}` },
      ],
    };
  }

  return {
    result: {
      decision: 'MANUAL_REVIEW',
      pipeline: 'manual_review_queue',
      reason_code: 'VR-002_MCO_UNKNOWN_PLAN',
      reason_human:
        'Medi-Cal MCO plan is not on file for this county. Route to manual review for panel confirmation.',
      rule_fired: 'VR-002',
      payer_matched: false,
      trace: [],
    },
    traceEntries: [
      { rule: 'VR-002', outcome: `manual: plan not in panel for ${input.county}` },
    ],
  };
}

/** VR-003 — Medicare Advantage, county-gated contracted panel. Owns member-id check. */
function routeMedicareAdvantage(
  input: ReferralInput,
  ctx: EvaluationContext,
): { result: EvaluationResult; traceEntries: TraceEntry[] } {
  const memberGate = requireMemberIdOr(
    input,
    'MANUAL_REVIEW',
    'VR-003',
    'VR-007_MA_MEMBER_ID_MISSING_MANUAL',
    'Medicare Advantage referral is missing a plan member ID. Route to manual review to capture the member ID, then re-evaluate.',
  );
  if (memberGate !== null) {
    return memberGate;
  }

  // VR-009 already guaranteed non-null county for this payer; narrow defensively.
  if (input.county === null) {
    return {
      result: {
        decision: 'BLOCK',
        pipeline: 'rejected',
        reason_code: 'VR-003_COUNTY_MISSING',
        reason_human: 'Medicare Advantage requires county; none provided.',
        rule_fired: 'VR-003',
        payer_matched: false,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-003', outcome: 'defensive: county null bypassed VR-009?' },
      ],
    };
  }

  const plansInCounty =
    ctx.contractedPlans.medicare_advantage_by_county[input.county] ??
    new Set<string>();
  const plan = normalizePlan(input.payer_plan_name);
  const matched = plan !== '' && plansInCounty.has(plan);

  if (matched) {
    return {
      result: {
        decision: 'PASS',
        pipeline: 'eligibility_queue',
        reason_code: 'VR-003_MA_IN_PANEL',
        reason_human: 'Medicare Advantage plan is contracted for the referral county.',
        rule_fired: 'VR-003',
        payer_matched: true,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-003', outcome: `pass: MA plan in contracted panel for ${input.county}` },
      ],
    };
  }

  return {
    result: {
      decision: 'MANUAL_REVIEW',
      pipeline: 'manual_review_queue',
      reason_code: 'VR-003_MA_UNKNOWN_PLAN',
      reason_human:
        'Medicare Advantage plan is not on the contracted panel for this county. Route to manual review for contract confirmation.',
      rule_fired: 'VR-003',
      payer_matched: false,
      trace: [],
    },
    traceEntries: [
      { rule: 'VR-003', outcome: `manual: MA plan unknown / not in panel for ${input.county}` },
    ],
  };
}

/** VR-004 — Commercial, contracted-panel-only (global). Owns member-id check. */
function routeCommercial(
  input: ReferralInput,
  ctx: EvaluationContext,
): { result: EvaluationResult; traceEntries: TraceEntry[] } {
  const memberGate = requireMemberIdOr(
    input,
    'MANUAL_REVIEW',
    'VR-004',
    'VR-007_COMMERCIAL_MEMBER_ID_MISSING_MANUAL',
    'Commercial referral is missing a plan member ID. Route to manual review to capture the member ID, then re-evaluate.',
  );
  if (memberGate !== null) {
    return memberGate;
  }

  const plan = normalizePlan(input.payer_plan_name);
  const matched = plan !== '' && ctx.contractedPlans.commercial.has(plan);

  if (matched) {
    return {
      result: {
        decision: 'PASS',
        pipeline: 'eligibility_queue',
        reason_code: 'VR-004_COMMERCIAL_IN_PANEL',
        reason_human: 'Commercial plan is contracted.',
        rule_fired: 'VR-004',
        payer_matched: true,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-004', outcome: 'pass: commercial plan in contracted panel' },
      ],
    };
  }

  return {
    result: {
      decision: 'MANUAL_REVIEW',
      pipeline: 'manual_review_queue',
      reason_code: 'VR-004_COMMERCIAL_UNKNOWN_PLAN',
      reason_human:
        'Commercial plan is not on the contracted panel. Route to manual review for contract confirmation.',
      rule_fired: 'VR-004',
      payer_matched: false,
      trace: [],
    },
    traceEntries: [
      { rule: 'VR-004', outcome: 'manual: commercial plan unknown / not in panel' },
    ],
  };
}

/** VR-005 — Self-Pay, manual until signed financial agreement is on file. */
function routeSelfPay(
  input: ReferralInput,
): { result: EvaluationResult; traceEntries: TraceEntry[] } {
  if (input.has_signed_financial_agreement === true) {
    return {
      result: {
        decision: 'PASS',
        pipeline: 'intake',
        reason_code: 'VR-005_SELF_PAY_AGREEMENT_ON_FILE',
        reason_human: 'Self-pay referral with signed financial agreement on file.',
        rule_fired: 'VR-005',
        payer_matched: true,
        trace: [],
      },
      traceEntries: [
        { rule: 'VR-005', outcome: 'pass: self-pay with signed financial agreement' },
      ],
    };
  }

  return {
    result: {
      decision: 'MANUAL_REVIEW',
      pipeline: 'manual_review_queue',
      reason_code: 'VR-005_SELF_PAY_NO_AGREEMENT',
      reason_human:
        'Self-pay referrals require a signed financial agreement before routing. Upload agreement to clear review.',
      rule_fired: 'VR-005',
      payer_matched: false,
      trace: [],
    },
    traceEntries: [
      { rule: 'VR-005', outcome: 'manual: self-pay without signed agreement' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Evaluate a referral against the VR-001..VR-009 rule set.
 *
 * Rule order (v2):
 *   1. VR-009 county-required global gate       (BLOCK or continue)
 *   2. VR-006 skip trace (manual-MVP seam)
 *   3. Per-payer routing (VR-001..VR-005)       — each owns its VR-007 check
 *
 * Pure at every layer. No shared mutable state: each rule function returns
 * `{ result, traceEntries }` and this function concatenates.
 *
 * Pure. No awaits. No I/O. The `resolveEligibility` seam exists on
 * `EvaluationContext` for future wiring and is intentionally unused here.
 */
export function evaluate(
  input: ReferralInput,
  ctx: EvaluationContext,
): EvaluationResult {
  const trace: TraceEntry[] = [];

  // --- VR-009: global county-required gate (fires first) -------------------
  const vr009 = checkCountyRequired(input, ctx);
  trace.push(...vr009.traceEntries);
  if (vr009.result !== null) {
    return { ...vr009.result, trace };
  }

  // --- VR-006: eligibility seam (manual MVP — no-op in v1) -----------------
  trace.push({
    rule: 'VR-006',
    outcome: 'skip: manual entry MVP; Stedi 270/271 post-MVP',
  });

  // --- Per-payer routing (VR-001..VR-005, each owns VR-007) ----------------
  const routed: { result: EvaluationResult; traceEntries: TraceEntry[] } =
    (() => {
      switch (input.payer_type) {
        case 'medicare_ffs':
          return routeMedicareFfs(input);
        case 'medi_cal_mco':
          return routeMediCalMco(input, ctx);
        case 'medicare_advantage':
          return routeMedicareAdvantage(input, ctx);
        case 'commercial':
          return routeCommercial(input, ctx);
        case 'self_pay':
          return routeSelfPay(input);
        default: {
          // Exhaustiveness guard — unknown payer_type should be impossible at
          // the type level, but we fall back to MANUAL_REVIEW rather than throw.
          const _exhaustive: never = input.payer_type;
          void _exhaustive;
          return {
            result: {
              decision: 'MANUAL_REVIEW',
              pipeline: 'manual_review_queue',
              reason_code: 'VR-000_UNKNOWN_PAYER_TYPE',
              reason_human:
                'Payer type is not recognized. Route to manual review for classification.',
              rule_fired: 'VR-000',
              payer_matched: false,
              trace: [],
            },
            traceEntries: [
              { rule: 'VR-000', outcome: 'manual: unknown payer_type' },
            ],
          };
        }
      }
    })();

  trace.push(...routed.traceEntries);
  return { ...routed.result, trace };
}

// ---------------------------------------------------------------------------
// Factory for an empty-but-valid MVP context. Consumers can spread into this.
// ---------------------------------------------------------------------------

/**
 * Factory for a valid `EvaluationContext` with safe MVP defaults.
 * `vr009Enforced` defaults to false — flip to true only after the county
 * backfill gate in crm-migration-add-county.sql passes.
 */
export function defaultContext(
  overrides: Partial<EvaluationContext> = {},
): EvaluationContext {
  return {
    contractedPlans: emptyContractedPlans(),
    vr009Enforced: false,
    ...overrides,
  };
}

export function emptyContractedPlans(): ContractedPlans {
  return {
    medicare_advantage_by_county: {
      los_angeles: new Set<string>(),
      san_bernardino: new Set<string>(),
      riverside: new Set<string>(),
      orange: new Set<string>(),
      san_diego: new Set<string>(),
    },
    commercial: new Set<string>(),
    medi_cal_mco_by_county: {
      los_angeles: new Set<string>(),
      san_bernardino: new Set<string>(),
      riverside: new Set<string>(),
      orange: new Set<string>(),
      san_diego: new Set<string>(),
    },
  };
}
