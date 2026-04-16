# Resume Guide

> **Read this file first if you're a Claude terminal picking up mid-session.** Tells you exactly where we left off.

## Session state as of 2026-04-15

### Planning work in this folder

- **Control files:** ✅ DONE (`START_HERE.md`, `STATUS.md`, `CONTEXT.md`, `STEP_INDEX.md`, `AGENTS.md`, `HOW_TO_USE.md`)
- **Phase 0 — Foundation:** ✅ DONE (all 5 step files written with full detail)
- **Phase 1 — Referral core:** 🟡 README only (4 step files TO WRITE)
- **Phase 2 — Orgs & contacts:** 🟡 README only (4 step files TO WRITE)
- **Phase 3 — Dashboard & tenant:** 🟡 README only (4 step files TO WRITE)
- **Phase 4 — Polish:** 🟡 README only (4 step files TO WRITE)
- **Phase 5 — Demo prep:** 🟡 README only (4 step files TO WRITE)
- **Post-MVP:** 🟡 README only (detailed weekly files TO WRITE)
- **Template:** ✅ DONE (`_templates/step-template.md`)

### Build work

- **Status:** Not started. Phase 0, step 0.1 is the first execution step.
- **Source of truth for build state:** `STATUS.md` in this folder.

## How to resume (two paths)

### Path A — Continue writing the playbook

If the user wants the remaining step files fleshed out:

1. Read `CONTEXT.md` and `../REF/CRM-MVP-2WEEK.md`
2. Use `_templates/step-template.md` as the template
3. For each missing step, write a detailed file following the pattern in `phase-0-foundation/0.1-repo-setup.md`
4. Order: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → post-mvp
5. Minimum per step: Prerequisites, Objective, Approach with code snippets, Files created, Acceptance criteria, Next

Priority order (write detailed versions of these first):
- `phase-1-referral-core/1.1-referral-crud.md`
- `phase-1-referral-core/1.2-pipeline-kanban.md`
- `phase-2-orgs-contacts/2.1-organization-crud.md`
- `phase-3-dashboard-tenant/3.1-dashboard-kpis.md`
- `phase-3-dashboard-tenant/3.3-tenant-switcher.md`

### Path B — Start building

If the user wants to start the build:

1. Read `START_HERE.md` → `STATUS.md` → `CONTEXT.md`
2. Open `phase-0-foundation/0.1-repo-setup.md`
3. Execute the step
4. Update `STATUS.md` after completion
5. Move to 0.2

## Files ready for execution

Phase 0 is fully documented and executable:
- `0.1-repo-setup.md` — monorepo scaffold, Next.js, Hono, shared packages
- `0.2-aws-infra.md` — Terraform for VPC, RDS, S3, KMS (us-west-1)
- `0.3-postgres-schema.md` — Drizzle schema, RLS policies, indexes, seed
- `0.4-workos-auth.md` — WorkOS AuthKit, role-based middleware, tenant context
- `0.5-vercel-deploy.md` — Vercel Enterprise dev deploy, CI/CD

**Phase 0 alone is enough to execute days 1-2 of the MVP sprint.** The rest can be written as we go or in a follow-up session.

## Context budget note

The detailed Phase 0 files took significant context. For Phases 1-5, consider:
- Using `Agent` with the `Plan` subagent to draft step files in parallel
- Writing tighter step files (less preamble, more action)
- Deferring post-MVP detail until after the demo

## Next user-facing summary

When the user returns, tell them:
1. Plans folder structure is complete
2. Phase 0 (days 1-2) is fully documented and executable
3. Phases 1-5 have READMEs; step files are stubs
4. They can either (a) continue writing playbook OR (b) start building with Phase 0

## Revision
- 2026-04-15: Initial resume note at end of planning session
