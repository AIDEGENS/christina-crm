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

## Dev setup (monorepo, as of step 0.1)

Turborepo + pnpm workspaces. Two apps, four shared packages.

```
christina-crm/
├── apps/
│   ├── crm-web/          # Next.js 15 App Router + Tailwind
│   └── crm-api/          # Hono on Node (tsx watch in dev)
├── packages/
│   ├── db/               # Drizzle + postgres (schema in step 0.3)
│   ├── auth/             # WorkOS client + tenant context helper (step 0.4)
│   ├── ui/               # shared components (wired when needed)
│   └── config/           # shared TS base config
├── Plans/                # phase roadmap (0.x → 5.x)
├── REF/                  # canonical reference docs (CRM-00..12)
├── hh-crm-mockup.html    # 8-view UI ground truth (from PR #1)
├── turbo.json
└── pnpm-workspace.yaml
```

### Prerequisites
- Node 20+ (24 works). If you hit EPERM on corepack, install pnpm via the standalone: `iwr https://get.pnpm.io/install.ps1 -useb | iex` in a fresh PowerShell.
- pnpm 9+ (this repo pins 10.33.0 via `packageManager`).
- Git with `AI_CHANNEL_IDENTITY` set in `.env` (see the top of this README — required by `git-flow`).

### Install + dev
```bash
pnpm install
pnpm turbo build            # full build
pnpm turbo dev --filter=crm-web   # Next.js on :3000
pnpm turbo dev --filter=crm-api   # Hono on :3001 → GET /health returns 200
```

### Verify step 0.1
- `pnpm install` — clean exit
- `pnpm turbo build` — clean exit
- `curl http://localhost:3001/health` — `{"status":"ok","service":"crm-api",...}`
- Visit `http://localhost:3000` — default Next.js scaffold page

### What is NOT wired yet (by design for pre-BAA scope)
- RDS / Postgres — comes in step 0.2 + 0.3
- WorkOS auth — step 0.4
- Vercel deploy — step 0.5
- Datadog — step 0.6
- Doppler secrets — step 0.7

## Links

- Workspace repo: https://github.com/AIDEGENS/Christina
- Module spec (intended design): `Christina/BrightPath_Vault/03_AI_Solutions/Custom_CRM.md`
- Working agreement: `Christina/WORKING_AGREEMENT.md`
- Phase roadmap: `Plans/` (phase-0 → phase-5)
