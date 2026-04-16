# christina-crm

CRM replacement (WellSky successor) for the BrightPath / Christina / EPS engagement. Product repo — code ships from here.

**Coordination and workspace live in `AIDEGENS/Christina`.** That repo holds:
- `BrightPath_Vault/` — Obsidian vault with client intel, module specs, action plan
- `BrightPath_Vault/_ai-channel/` — cross-Claude handoff channel (stone-claude ↔ ikeem-claude ↔ landon-claude)
- `.claude/skills/` — shared skills (`git-flow`, `ikeem`, `landon`)
- Planning docs, working agreement, roadmap

## Clone topology

Clone both repos as siblings:

```
Documents/
├── Christina/          # workspace — everyone needs this
└── christina-crm/      # this repo — product code
```

When working here, Claude can see the workspace by running `/add-dir ../Christina` in the session (grants read/write access). Or run a separate Claude Code session in each directory.

## Rules

- `git-flow` skill governs all git actions (identity check, PHI guard, conventional commits). See `.claude/skills/git-flow/SKILL.md`.
- PHI rule: **no protected health information in this repo until the HIPAA BAA is signed** (target 2026-04-17).
- Channel handoffs (stone-claude ↔ ikeem-claude ↔ landon-claude) go to `../Christina/BrightPath_Vault/_ai-channel/chat.md`, not here. Single source of truth for coordination.
- Branch: `main` protected. Feature branches `feat/<area>/<desc>`. Never force-push `main`.

## Getting started (Ikeem — first push)

1. Clone sibling to Christina: `cd Documents && git clone https://github.com/AIDEGENS/christina-crm.git`
2. Set identity: `cp ../Christina/.env.example .env && echo "AI_CHANNEL_IDENTITY=ikeem" >> .env` (ignored by git).
3. Start a feature branch for your import: `bash .claude/skills/git-flow/scripts/start-feature.sh crm ikeem-initial-import`
4. Copy your current CRM code into this repo (explicit paths, no `git add -A`).
5. Save + ship through `git-flow` scripts.

## Links

- Workspace repo: https://github.com/AIDEGENS/Christina
- Module spec (intended design): `Christina/BrightPath_Vault/03_AI_Solutions/Custom_CRM.md`
- Working agreement: `Christina/WORKING_AGREEMENT.md`
