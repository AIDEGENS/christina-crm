---
name: git-flow
description: Use whenever the user asks to commit, push, pull, branch, open a PR, sync with main, or says "save this", "ship it", "I'm done", "start a new feature", "commit", "push", "new branch". Encodes the Stone+Ikeem git workflow for AIDEGENS/Christina — pull-before-edit, no `-A` staging, feat/<module>/<desc> branches, conventional commits, PHI guard, and cross-Claude channel handoff.
---

# git-flow — Stone & Ikeem workflow

One skill for every git action on this repo. Scripts live in `scripts/`. The human-readable version of these rules is `WORKING_AGREEMENT.md` — do not drift from it.

## Identity (first thing, every time)

```bash
: "${AI_CHANNEL_IDENTITY:?Set AI_CHANNEL_IDENTITY (stone-claude or ikeem-claude) in .env before using git-flow}"
echo "acting as: $AI_CHANNEL_IDENTITY"
```

If unset, stop and tell the user to add it to `.env`. Never push with an unknown identity — commits get mis-attributed.

## Trigger → action

| User says | Run |
|---|---|
| "start a feature X on module Y" | `bash .claude/skills/git-flow/scripts/start-feature.sh <module> <desc>` |
| "save this", "commit this", "save as <type>: ..." | `bash .claude/skills/git-flow/scripts/save.sh "<type>: <message>"` |
| "ship it", "open PR", "I'm done" | `bash .claude/skills/git-flow/scripts/ship.sh` |
| "pull", "sync" | `git pull --rebase` |
| "what's my status" | `git status && git log --oneline -5` |

## Branch rules (hard)

- `main` — never commit directly, never force-push. If on `main` and user asks to save, refuse and run `start-feature.sh` instead.
- Feature: `feat/<module>/<short-desc>`. Fix: `fix/<module>/<desc>`. Docs: `docs/<area>/<desc>`.
- `onboarding/ikeem-setup` is Ikeem's one-off. Stone-claude does not commit there.

## Commit message (enforced by `save.sh`)

`<type>: <imperative summary>` where type ∈ `{feat, fix, docs, chore, refactor, test}`. Longer body only when behavior changes cross modules.

## PHI guard (enforced until 2026-04-17 BAA)

`save.sh` greps the staged diff for:
- SSN: `\b\d{3}-\d{2}-\d{4}\b`
- MRN: `MRN[-_: ]?\d`
- DOB: `\bDOB[: =]`
- Obvious patient identifiers: `patient[_ ]id`, `claim[_ ]id.*\d{6}`

On hit: block, print offending file+line, ask the user. Do not override without explicit human confirmation.

## Conflicts

Never auto-resolve. Stop, run `git diff --name-only --diff-filter=U`, summarize each conflicting hunk to the user, let them pick.

## Cross-Claude handoff (after `ship.sh`)

`ship.sh` appends a signed block to `BrightPath_Vault/_ai-channel/chat.md`:

```
## <ISO timestamp> — <AI_CHANNEL_IDENTITY>
shipped: <PR title> (<PR url>)
next: <one-line hint for the other Claude>
---
```

This is how stone-claude and ikeem-claude hand work back and forth across sessions.

## Gotchas (read before every commit)

- **Never `git add -A` or `git add .`** — use `git add -u` + explicit paths. Keeps `.env`, stray PDFs, OS junk out.
- If `git status` shows `.env`, `*.pdf`, `node_modules/`, `__pycache__/`, or anything in `.cursors/` → stop and ask.
- **Never `--no-verify`, never `--force-with-lease` on main, never amend a pushed commit.**
- If the commit hook fails, fix the underlying issue — do not skip.
- After `save.sh` pushes, glance at `gh pr checks` if a PR is open; surface red checks to the user.

## When to use `git-flow` vs raw git

Always. If the user asks a raw `git` question (read-only: log, diff, blame, show) you can run it directly. For any state-changing action (add, commit, push, branch, merge, rebase, reset, checkout of a dirty tree) go through the scripts in this skill.
