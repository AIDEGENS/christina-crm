# Step Index

> Master index of all build steps with dependencies. Use this to understand what can run in parallel and what blocks what.

## Legend

- **ID** — step identifier (phase.step)
- **Blocks** — steps that cannot start until this one completes
- **Blocked by** — steps that must complete before this one can start
- **Can parallel** — can run concurrently with these

## Phase 0 — Foundation (Days 1-2)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 0.1 | Repo setup | — | 0.2, 0.3, 0.4, 0.5 | — |
| 0.2 | AWS infra (us-west-1) | 0.1 | 0.3, 0.5, 0.6 | 0.4 |
| 0.3 | Postgres schema + RLS | 0.1, 0.2 | 1.1 | 0.4 |
| 0.4 | WorkOS auth | 0.1 | 1.1, 3.3 | 0.2, 0.3 |
| 0.5 | Vercel deploy (dev) | 0.1, 0.2 | 0.6, 1.1 | 0.4 |
| 0.6 | Datadog observability + PHI scrub | 0.1, 0.2, 0.5 | 0.7, 1.1 | — |
| 0.7 | Secrets management (Doppler) | 0.1-0.6 | EXIT | — |

**Phase 0 exit gate:** run `phase-0-foundation/PHASE-0-EXIT.md` end-to-end. All checkboxes must pass before starting Phase 1.

## Phase 1 — Referral core (Days 3-5)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 1.1 | Referral CRUD (API + form) | 0.3, 0.4, 0.5 | 1.2, 1.3 | — |
| 1.2 | Pipeline kanban UI | 1.1 | 1.4 | 1.3 |
| 1.3 | Referral detail page | 1.1 | 1.4 | 1.2 |
| 1.4 | Notes + document upload shell | 1.2, 1.3 | 2.1 | — |

**Phase 1 exit gate:** can enter a referral by hand, drag it through pipeline stages, open detail view.

## Phase 2 — Orgs & contacts (Days 6-8)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 2.1 | Organization CRUD | 1.4 | 2.2, 2.3 | — |
| 2.2 | NPPES NPI lookup | 2.1 | 2.4 | 2.3 |
| 2.3 | Contact directory CRUD | 2.1 | 2.4 | 2.2 |
| 2.4 | Org scorecards | 2.2, 2.3 | 3.1 | — |

**Phase 2 exit gate:** can add orgs + contacts, auto-enrich via NPPES, see scorecards with referral counts.

## Phase 3 — Dashboard & tenant (Days 9-10)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 3.1 | Dashboard KPIs | 2.4 | 3.2 | — |
| 3.2 | Activity feed | 3.1 | 3.4 | 3.3 |
| 3.3 | Tenant switcher UI | 0.4 | 3.4 | 3.1, 3.2 |
| 3.4 | RLS validation test suite | 3.1, 3.2, 3.3 | 4.1 | — |

**Phase 3 exit gate:** dashboard shows real data, can switch HH ↔ Hospice and see different rows, RLS verified.

## Phase 4 — Polish (Days 11-12)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 4.1 | Responsive mobile layout | 3.4 | 5.3 | 4.2, 4.3 |
| 4.2 | Global search (pg_trgm) | 3.4 | — | 4.1, 4.3, 4.4 |
| 4.3 | Settings page shell | 3.4 | — | 4.1, 4.2, 4.4 |
| 4.4 | Loading / empty / error states | 3.4 | 5.3 | 4.1, 4.2, 4.3 |

**Phase 4 exit gate:** app works on a phone, search returns results, no janky loading flashes.

## Phase 5 — Demo prep (Days 13-14)

| ID | Step | Blocked by | Blocks | Can parallel |
|---|---|---|---|---|
| 5.1 | Seed realistic demo data | 4.4 | 5.3 | 5.2 |
| 5.2 | Email notification (new referral) | 4.4 | 5.3 | 5.1 |
| 5.3 | Demo walkthrough script | 5.1, 5.2 | 5.4 | — |
| 5.4 | Client demo handoff | 5.3 | POST-MVP | — |

**Phase 5 exit gate:** client has seen the demo and said "keep building" (or given actionable feedback).

## Post-MVP — Weeks 3-10

See `post-mvp/README.md` for full breakdown. High-level:

- **Weeks 3-4:** AI fax parsing (Bedrock), Stedi 270/271 eligibility, denial risk scoring hook
- **Weeks 4-5:** BD visit logging + GPS, full mobile PWA, reports + CSV/PDF export
- **Weeks 5-6:** Twilio SMS, QuickBooks integration, full audit log UI
- **Weeks 6-8:** WellSky CSV import, dual-run, migration tooling
- **Weeks 8-10:** Security review (pen-test-lite), DR drill, SOC 2 Type 1 kickoff, cutover

## Parallel execution strategy

See `AGENTS.md` for when to spin up parallel subagents.

Quick reference:
- **Phase 0:** 0.2 + 0.4 can run in parallel after 0.1; 0.3 depends on 0.2
- **Phase 1:** 1.2 + 1.3 can run in parallel after 1.1
- **Phase 2:** 2.2 + 2.3 can run in parallel after 2.1
- **Phase 3:** 3.3 can start after 0.4; 3.1 + 3.3 in parallel
- **Phase 4:** all 4 steps can run in parallel after 3.4

Maximum parallelism is in Phase 4. Minimum is Phase 1 where the data model dependencies serialize most work.
