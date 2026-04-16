# CLAUDE.md — AIDEGENS/christina-crm

Product repo for the CRM replacement. The **workspace** is `AIDEGENS/Christina` (cloned as a sibling at `../Christina/`).

## Git & collab (non-negotiable)

1. **Any git action goes through the `git-flow` skill.** Commit, push, branch, PR, sync — all of it. Do not run raw `git` state-changing commands. See `.claude/skills/git-flow/SKILL.md`.
2. **Identity must be set.** `AI_CHANNEL_IDENTITY` (`stone`, `ikeem`, or `landon`) must be in `.env` before any push. If unset, stop and ask the human.
3. **No PHI in this repo until 2026-04-17 BAA is signed.** The PHI guard in `save.sh` blocks obvious patterns but is not exhaustive — when in doubt, ask, leave it out.

## Cross-repo handoffs live in Christina, not here

The shared AI channel (`stone-claude` ↔ `ikeem-claude` ↔ `landon-claude`) is at `../Christina/BrightPath_Vault/_ai-channel/chat.md`. When `ship.sh` writes a handoff note, it targets that sibling path — **always** check that `../Christina/` exists and is a git clone of `AIDEGENS/Christina` before running ship. If it doesn't exist, clone it first:

```bash
( cd .. && git clone https://github.com/AIDEGENS/Christina.git )
```

The channel commit + push happens in the Christina repo, not here.

## The three moves humans will ask for

- "start a feature" → `git-flow` runs `start-feature.sh <area> <desc>` (branches off fresh main).
- "save this" / "commit this" → `git-flow` runs `save.sh "<type>: <message>"` (stages tracked files, PHI-checks, commits, pushes).
- "ship it" / "I'm done" → `git-flow` runs `ship.sh` (opens PR via `gh`, posts signed handoff to `../Christina/BrightPath_Vault/_ai-channel/chat.md`).

## What not to do

- Never `git add -A` / `git add .` — use `save.sh`.
- Never commit directly to `main` or force-push it.
- Never `--no-verify` or amend a pushed commit.
- Never auto-resolve merge conflicts — stop and ask the human.
- Never commit PHI. When in doubt, ask Stone.

## Module spec

Intended CRM design (data model, tenant model, WellSky migration): `../Christina/BrightPath_Vault/03_AI_Solutions/Custom_CRM.md`.
