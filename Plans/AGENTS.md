# Agent & Subagent Strategy

> When to use parallel subagents, when to stay solo, and how the 3-role Agent Team maps to this build.

## The 3-role Agent Team pattern

From `../REF/CRM-12-AGENT-TEAM-PLAN.md`. Fork `/agent-team-build-loop` as `/crm-build-loop`:

### Role 1 — Architect
- Owns: schema migrations, API contracts, RLS policies, Terraform/CDK, Inngest workflow definitions (later)
- Reviews: any PR touching data model, auth, or infra
- Skills: `senior-architect`, `database-design`, `postgres-best-practices`, `saas-multi-tenant`, `terraform-specialist`

### Role 2 — Builder
- Owns: Next.js pages/components, API routes, Bedrock prompts (post-MVP), UI work
- Skills: `react-nextjs-development`, `shadcn`, `tailwind-design-system`, `hono`, `drizzle-orm-expert`

### Role 3 — Compliance Reviewer
- Reviews: every PR before merge through HIPAA lens
- Checks: PHI exposure, RLS bypass, audit log coverage, prompt injection (post-MVP)
- Skills: `security-auditor`, `privacy-by-design`, `threat-modeling-expert`, `auth-implementation-patterns`

### Automated Validator
- TypeScript check, ESLint, unit tests, Playwright E2E, SAST scan
- Gate: PR cannot merge unless validator passes

## When to spawn subagents vs stay solo

### Stay solo (main thread) when:
- The step is linear and small (~15 min of work)
- You need to write files in a specific order with dependencies
- The step involves tight coordination with `STATUS.md` updates
- Unclear spec — need a conversation, not a fan-out

### Spawn subagents when:
- Two or more steps in the same phase can run in parallel (see `STEP_INDEX.md` "Can parallel" column)
- Research task that would pollute main context (e.g., "find all WorkOS SDK examples for our role setup")
- PR review — spawn the Compliance Reviewer agent as a separate invocation
- Large refactor that spans many files — one agent per concern (UI, API, tests)

### Never spawn subagents for:
- Decisions that require client input (those are `[CONFIRM]` blockers)
- Work that modifies `STATUS.md` — only the main thread updates status
- Commits/pushes — main thread orchestrates git

## Parallel execution recipes

### Phase 0 parallel
After 0.1 completes, spawn:
- Agent A: execute 0.2 (AWS infra)
- Agent B: execute 0.4 (WorkOS auth)

Main thread waits, then executes 0.3 (needs 0.2), then 0.5 (needs 0.2).

### Phase 1 parallel
After 1.1 completes, spawn:
- Agent A: execute 1.2 (pipeline kanban)
- Agent B: execute 1.3 (referral detail)

Main thread integrates and executes 1.4.

### Phase 2 parallel
After 2.1 completes, spawn:
- Agent A: execute 2.2 (NPPES lookup)
- Agent B: execute 2.3 (contact CRUD)

Main thread waits, then executes 2.4.

### Phase 4 — maximum parallelism
After 3.4 completes, spawn all 4 Phase 4 steps in parallel:
- Agent A: 4.1 responsive mobile
- Agent B: 4.2 search
- Agent C: 4.3 settings shell
- Agent D: 4.4 loading states

Main thread integrates.

## Agent prompting template

When spawning a subagent, always include:

```
You are working on the Medical CRM build. Read these files first:
- C:\Users\clayi\OneDrive\Desktop\Medical CRM\Plans\CONTEXT.md
- C:\Users\clayi\OneDrive\Desktop\Medical CRM\Plans\STATUS.md
- C:\Users\clayi\OneDrive\Desktop\Medical CRM\Plans\phase-X-Y\Z.Z-step.md

Your task: execute step Z.Z exactly as specified. Do not skip acceptance criteria.

Constraints (from CONTEXT.md):
- All AWS resources in us-west-1
- No Clerk, no Supabase < Team, no Change Healthcare
- All PHI encrypted at rest (KMS)
- Never commit secrets

Report back with:
1. Which acceptance criteria passed (checklist)
2. Any files created/modified
3. Any decisions or deviations with reasoning
4. Whether the step is COMPLETED or BLOCKED (and why)
```

## Compliance Reviewer invocation

For any PR touching PHI, auth, or S3, invoke the Compliance Reviewer as a separate agent:

```
You are the Compliance Reviewer for the Medical CRM build. Review PR #N through a HIPAA lens.

Check for:
1. PHI exposure in logs, error messages, URLs, or non-BAA services
2. RLS policy coverage — can a user see data from another tenant?
3. Audit log coverage — is every PHI read/write logged?
4. Minimum-necessary — does the UI show only initials + age, not full name?
5. Encryption — are new columns encrypted if they contain PHI?
6. Secrets — any hardcoded API keys, passwords, DB connection strings?

Report: APPROVED, APPROVED_WITH_NOTES, or BLOCKED. Cite specific file:line for each finding.
```

## Task/todo tracking

- Use the harness's `TaskCreate` / `TaskUpdate` tools to track in-flight work
- But the source of truth for build progress is `STATUS.md` — update it explicitly
- Tasks are ephemeral (per-session); STATUS.md is durable

## Handoff between sessions

When ending a session:
1. Update `STATUS.md` with current step + any notes
2. Commit all uncommitted changes with a WIP branch if needed
3. Leave breadcrumbs in the current step file's "Notes" section

When starting a session:
1. Read `START_HERE.md`
2. Read `STATUS.md`
3. Read `CONTEXT.md`
4. Open the current step file
5. If step is IN_PROGRESS, resume from where it left off; check git status for WIP
