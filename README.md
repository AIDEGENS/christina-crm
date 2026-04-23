# christina-crm

CRM replacement (WellSky successor) for the BrightPath / Christina / EPS engagement. Product repo — code ships from here.

**Coordination and workspace live in `AIDEGENS/Christina`.** That repo holds:
- `BrightPath_Vault/` — Obsidian vault with client intel, module specs, action plan
- `BrightPath_Vault/_ai-channel/` — cross-Claude handoff channel (stone-claude ↔ ikeem-claude ↔ landon-claude)
- `.claude/skills/` — shared skills (`git-flow`, `ikeem`, `landon`)
- Planning docs, working agreement, roadmap

## Prerequisites

- **Node 20** (`nvm use` picks it up from `.nvmrc`)
- **pnpm 9** — `npm i -g pnpm@9`
- **Git Bash / MSYS** on Windows (scripts are bash)

## Install

```bash
pnpm install
```

## Dev

```bash
pnpm dev           # starts all apps in parallel via Turborepo
# or individually:
cd apps/web && pnpm dev    # Next.js on :3000
cd apps/api && pnpm dev    # Hono on :3001
```

Health checks:
- `http://localhost:3000/health` — Next.js route → `{ok:true, phase:"0.1"}`
- `http://localhost:3001/health` — Hono → `{ok:true}`

## Build / Lint / Typecheck

```bash
pnpm build
pnpm lint
pnpm typecheck
```

## Git workflow (non-negotiable)

All git actions go through `git-flow` skill or the scripts directly.

### Start a feature branch

```bash
./scripts/start-feature.sh <area> <desc>
# Example:
./scripts/start-feature.sh backend initial-hono-server
```

Valid areas: `frontend backend infra db auth verification docs security qa growth`

### Commit and push

```bash
# Stage new/untracked files first if needed:
git add <specific-file>

# Then commit (stages tracked changes, PHI-checks, commits, pushes):
./scripts/save.sh "feat: add referral form"
```

`save.sh` requires `AI_CHANNEL_IDENTITY` in `.env` (one of `stone|ikeem|landon`).

### Windows Git Bash note

Scripts use `#!/usr/bin/env bash`. After cloning, mark them executable:

```bash
git update-index --chmod=+x scripts/save.sh scripts/start-feature.sh
```

Or run directly with bash:

```bash
bash scripts/start-feature.sh backend my-feature
```

## Phase roadmap

See `Plans/STEP_INDEX.md` for the full dependency graph.

| Phase | Focus | Blocks |
|---|---|---|
| 0.1 | Repo scaffold (this step) | 0.2–0.5 |
| 0.2 | AWS infra (us-west-1) | 0.3, 0.5 |
| 0.3 | Postgres schema + RLS | 1.1 |
| 0.4 | WorkOS auth | 1.1, 3.3 |
| 0.5 | Vercel deploy (dev) | 0.6 |
| 1.x | Referral CRUD + pipeline | 2.x |

## Clone topology

Clone both repos as siblings:

```
Documents/
├── Christina/          # workspace — coordination, vault, handoff channel
└── christina-crm/      # this repo — product code
```

## Links

- Workspace repo: https://github.com/AIDEGENS/Christina
- Module spec: `Christina/BrightPath_Vault/03_AI_Solutions/Custom_CRM.md`
- Working agreement: `Christina/WORKING_AGREEMENT.md`
- PHI guard spec: comments in `scripts/save.sh` + `.github/workflows/ci.yml`
