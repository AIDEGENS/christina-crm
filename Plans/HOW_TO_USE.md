# How to Use This Playbook

> Deeper reference for Claude terminals. If `START_HERE.md` + `STATUS.md` wasn't enough, read this.

## Mental model

Think of this folder as a **state machine** where:
- Each **step** is a state
- Each step file is the **transition function** (what to do in this state + how to move to the next)
- `STATUS.md` is the **current state indicator**
- `CONTEXT.md` is the **global context** carried across all states

Any Claude terminal can pick up the state machine by reading `STATUS.md` and executing the current step.

## Anatomy of a step file

Every step file has this structure:

```markdown
# Step X.Y — [Name]

## Status
PENDING | IN_PROGRESS | BLOCKED | COMPLETED | SKIPPED

## Prerequisites
- Step X.Z completed
- (any external blockers)

## Context files to load
- ../CONTEXT.md
- ../../REF/CRM-04-ARCHITECTURE.md (specific spec files)

## Objective
One-paragraph description of what this step accomplishes.

## Approach
Numbered steps with concrete actions. Commands to run. Files to create.

## Files created/modified
- `apps/crm-web/app/...`
- `packages/db/schema/...`

## Acceptance criteria
Every checkbox must pass before marking COMPLETED:
- [ ] Criterion 1 (verifiable)
- [ ] Criterion 2 (verifiable)

## Common issues
- Issue A → solution
- Issue B → solution

## When done
1. Run acceptance criteria verification
2. Update STATUS.md (mark this step COMPLETED, set next step)
3. Commit: `git commit -m "step X.Y: [summary]"`

## Next
→ Step X.Z
```

## The update loop

After every step:

```
┌──────────────────────────────────────────────┐
│ 1. Read current step file                    │
│ 2. Execute actions                           │
│ 3. Verify ALL acceptance criteria checkboxes │
│ 4. Commit work (branch per step)             │
│ 5. Update STATUS.md:                         │
│    - Mark current step COMPLETED             │
│    - Move to Completed steps list            │
│    - Set next step as Current                │
│    - Add to Notes/decisions log              │
│ 6. Open next step file                       │
│ 7. Go to step 1                              │
└──────────────────────────────────────────────┘
```

## Working with PRs

Every step produces a PR (or direct commit on a personal branch). Pattern:

```bash
git checkout -b step-X.Y-name
# ... do the work ...
git add .
git commit -m "step X.Y: [summary]

Implements: [what the step does]
Acceptance: [link to step file]
"
git push -u origin step-X.Y-name
gh pr create --title "Step X.Y — [name]" --body "[acceptance criteria checklist]"
```

The Compliance Reviewer agent should review every PR that touches:
- PHI handling
- Authentication / authorization
- S3 / file upload
- Audit log
- Anything cross-tenant

## Handling blockers

If a step cannot proceed:

1. Update STATUS.md: mark step as BLOCKED
2. Edit the step file's "Status" section: explain why
3. Add to the "Blocked" section in STATUS.md with:
   - What's blocking
   - Who/what we're waiting on
   - Suggested workaround if any
4. If possible, move to a non-blocked step in parallel
5. Re-check blocker at start of every session

**Never silently skip or fudge a blocker.** Document everything.

## Modifying a step

Specs change. If a step needs updating based on new information:

1. Edit the step file directly
2. Add a note in the step file's "Revision history" section at bottom:
   ```
   ## Revision history
   - 2026-04-15: Original
   - 2026-04-17: Updated based on [decision/file]; changed X to Y
   ```
3. Add a decision log entry in STATUS.md
4. Continue executing

## Adding a new step

If you discover mid-build that a step is missing:

1. Copy `_templates/step-template.md` to the appropriate phase folder
2. Name it `X.Y-description.md` (use the next available number)
3. Fill in the template
4. Update `STEP_INDEX.md` to add the new step with dependencies
5. Update `STATUS.md` progress counts

## Rolling back a step

If a step was completed incorrectly:

1. Don't panic. Revert in git: `git revert <commit>` (or `git reset` if not pushed)
2. Mark the step as IN_PROGRESS again in STATUS.md
3. Add a revision note explaining what went wrong
4. Re-execute with the fix

## Cross-session continuity

Sessions end. New Claude terminals start. The handoff works because:

- `STATUS.md` contains the current step
- `CONTEXT.md` contains the immutable constraints
- Step files contain the how-to
- Git history contains the work done
- `STATUS.md` Notes section contains the why behind recent decisions

**Any Claude terminal should be able to pick up the build within 5 minutes of reading these four sources.**

## What NOT to do

- **Don't trust memory across sessions** — always re-read STATUS.md
- **Don't skip acceptance criteria** — half-done is not done
- **Don't change the stack** — constraints in CONTEXT.md are locked
- **Don't commit PHI** — even test data, use initials + fake MRNs
- **Don't bypass the Compliance Reviewer** on PHI/auth/audit PRs
- **Don't add features not in the spec** — scope discipline is how we hit 2 weeks

## Emergency contacts (in-file)

If truly stuck:
- Spec: `../REF/CRM-ANSWERS.md` (locked decisions)
- Parent project: `../../Insurance Claims/REF/STRATEGY.md`
- BAA status: `../../Insurance Claims/REF/BAA-CHECKLIST.md`
- Architecture questions: `../REF/CRM-04-ARCHITECTURE.md`
- Security questions: `../REF/CRM-08-SECURITY-HIPAA.md`
