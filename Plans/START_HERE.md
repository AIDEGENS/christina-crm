# START HERE — Medical CRM Build Playbook

> **For any Claude terminal picking up this project.** Read this file first, then `STATUS.md`, then execute the current step. This folder is the execution guide; spec lives in `../REF/`.

## How to use this folder

The build is broken into numbered phases and steps. Every step is self-contained — you can pick up mid-build by reading `STATUS.md` and opening the current step file.

### Standard operating loop

1. **Read `STATUS.md`** — tells you the current phase, current step, and what's next
2. **Read `CONTEXT.md`** — always-load context (stack decisions, hard constraints, client details)
3. **Open the current step file** — e.g., `phase-0-foundation/0.1-repo-setup.md`
4. **Execute** — follow the step exactly. Each step lists prerequisites, files to create, commands, and acceptance criteria.
5. **Verify acceptance criteria** — do NOT mark a step complete unless every checkbox passes
6. **Update `STATUS.md`** — mark current step complete, set next step
7. **Move to the next step**

### If you get stuck

- Check the step's **"Common issues"** section
- Re-read `CONTEXT.md` — you may be violating a hard constraint
- Check the spec: `../REF/CRM-04-ARCHITECTURE.md` and related files
- Mark the step as **BLOCKED** in `STATUS.md` with the reason; don't fake success

### If a step seems wrong

The spec has been iterated multiple times. If you think a step is out of date or conflicts with `../REF/CRM-ANSWERS.md`, update the step file first, THEN execute. Commit your reasoning in `STATUS.md`.

## Folder map

```
Plans/
├── START_HERE.md              ← you are here
├── STATUS.md                  ← current build state (always read after START_HERE)
├── CONTEXT.md                 ← always-load context (stack, constraints, client)
├── STEP_INDEX.md              ← all steps numbered with dependencies
├── AGENTS.md                  ← when to use parallel subagents vs solo
├── HOW_TO_USE.md              ← deeper guide for new Claude terminals
├── phase-0-foundation/        ← Days 1-2: repo, AWS, Postgres, auth
├── phase-1-referral-core/     ← Days 3-5: referral CRUD + pipeline
├── phase-2-orgs-contacts/     ← Days 6-8: orgs, contacts, scorecards
├── phase-3-dashboard-tenant/  ← Days 9-10: dashboard + tenant switcher
├── phase-4-polish/            ← Days 11-12: responsive, search, settings
├── phase-5-demo-prep/         ← Days 13-14: seed, notifications, demo
├── post-mvp/                  ← Weeks 3-10: AI, Stedi, QB, migration, cutover
└── _templates/                ← step template for adding new steps
```

## Rules

- **Never skip steps.** Phase 0 before Phase 1, step 0.1 before 0.2.
- **Never break hard constraints.** See `CONTEXT.md`. No Clerk, no Supabase < Team, no Change Healthcare, no PHI through n8n Cloud, all AWS in us-west-1.
- **Never commit PHI.** Test data uses initials + fake MRNs.
- **Always update STATUS.md** after each step.
- **Always cite the spec** when making a judgment call. Reference specific files in `../REF/`.

## The MVP target (2-3 weeks)

A demo-able CRM the client can log into and:
1. Add referrals manually (word-of-mouth is primary channel per `CRM-ANSWERS.md`)
2. See them on a pipeline kanban
3. Manage organizations and contacts
4. View a dashboard
5. Switch between HH and Hospice tenants
6. Use it on their phone

What we DON'T ship in the MVP: AI fax parsing, Stedi eligibility, denial risk scoring, QuickBooks, Twilio SMS, WellSky import, full audit log UI. All of that is in `post-mvp/`.

## Next

→ Open `STATUS.md` to see where we are. If it says "Not started," begin at `phase-0-foundation/0.1-repo-setup.md`.
