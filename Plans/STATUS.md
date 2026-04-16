# Build Status

> **Always update this file after completing a step.** Any Claude terminal reads this to know where we are.

## Current state

- **Phase:** Phase 0 — Foundation (not started)
- **Current step:** 0.1 — Repo setup
- **Last updated:** 2026-04-15 (discovery complete, answers locked)
- **Updated by:** Claude (Opus 4.6)

## Progress summary

- **MVP steps:** 0 / 27 complete
- **Phase 0 — Foundation:** 0 / 7
- **Phase 1 — Referral core:** 0 / 4
- **Phase 2 — Orgs & contacts:** 0 / 4
- **Phase 3 — Dashboard & tenant:** 0 / 4
- **Phase 4 — Polish:** 0 / 4
- **Phase 5 — Demo prep:** 0 / 4

## Next up

1. **0.1 — Repo setup** ← START HERE
2. 0.2 — AWS infra (us-west-1)
3. 0.3 — Postgres schema + RLS
4. 0.4 — WorkOS auth
5. 0.5 — Vercel deploy (dev)
6. 0.6 — Datadog observability + PHI scrubbing
7. 0.7 — Secrets management (Doppler)
8. Run `PHASE-0-EXIT.md` runbook before starting Phase 1

## Completed steps

_(none yet)_

## In progress

_(none)_

## Blocked

_(none)_

## Notes / decisions log

### 2026-04-15 — Discovery complete
- All 20 questions answered. See `../REF/CRM-ANSWERS.md`.
- Client wants 2-3 week MVP demo.
- Word of mouth is primary referral channel (not fax). AI fax parsing deferred.
- $4,000/mo Enterprise tier.
- California data residency — use us-west-1, not us-west-2.
- 2 WellSky modules (HH + Hospice) → 2 tenants in our system.
- Monorepo with claims platform confirmed.

### (Add entries here as decisions are made during build)

---

## Status values for steps

- `PENDING` — not started
- `IN_PROGRESS` — actively working on it
- `BLOCKED` — cannot proceed; see reason in step file
- `COMPLETED` — acceptance criteria all passing
- `SKIPPED` — consciously bypassed (document why in step file)
