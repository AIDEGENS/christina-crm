# Christina CRM — 24-7 Team Hub (Notion Spec)

> Dedicated Notion hub for the `christina-crm` + `christina-crm-inspect` build. Separate from the master 24-7 Team Hub (`21f52998-9385-83af-a333-01393ec78bd0`) so Claims doesn't bleed into Christina work.
>
> Deployment: once Rube MCP / Notion API is connected, agent reads this file and creates every page + DB in one pass.

---

## 1 — Hub page

- **Title:** `Christina CRM — 24-7 Team Hub`
- **Icon:** 🏥
- **Cover:** teal gradient (matches Recovera palette for agency continuity)
- **Parent:** top-level workspace page (Ikeem clay's workspace, same as master hub)
- **Env var name (for skills):** `CHRISTINA_CRM_HUB_ID`

### Hub body blocks

1. **Callout (blue, info):** "Repos: `C:\Users\clayi\christina-crm` (product) + `C:\Users\clayi\christina-crm-inspect` (verifier). Spec: `../REF/CRM-*.md`. Status: `Plans/STATUS.md`."
2. **H2 — Active Sprint** → linked view of `CRM Sprint Board` DB filtered Status ≠ Done
3. **H2 — Team Backlogs** → 9 linked views, one per team DB (grid view, Status=Todo|In Progress)
4. **H2 — Verification Agent Rules** → linked view of `Verification Rules` DB
5. **H2 — Blockers** → linked view of `Blockers` DB filtered Resolved=false
6. **H2 — Daily Handoff Log** → linked view of `Handoff Log` DB sorted Date desc
7. **H2 — PR Inbox** → linked view of `PR Inbox` DB filtered Status=open

---

## 2 — Databases (12 total)

All DBs live as **child databases** of the hub page. IDs captured back into `.omc/notion-hub-ids.json` on first deploy.

### 2.1 — `CRM Sprint Board` (master)

Single pane of glass for current MVP phase work.

| Property | Type | Options / Notes |
|----------|------|-----------------|
| Title | title | |
| Step ID | rich_text | e.g. `0.1`, `1.3`, `V.2` (V prefix = Verification Agent) |
| Phase | select | Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Post-MVP |
| Team | select | Product, Design, Frontend, Backend, QA, DevOps, Security, Data, Growth, Verification |
| Status | status | Todo, In Progress, Review, Blocked, Done |
| Priority | select | P0, P1, P2, P3 |
| Blocked By | relation → self | |
| Blocks | relation → self | auto-inverse |
| Assignee | people | |
| Branch | rich_text | `step-0.1-repo-setup` |
| PR | url | |
| Acceptance criteria | rich_text | copied from step file |
| Evidence | files | screenshots, test output |
| Started | date | |
| Completed | date | |

**Seed rows:** all 27 MVP steps + 5 Verification Agent steps (V.1–V.5). See §4.

### 2.2 — `Verification Rules`

Canonical rule registry for the Verification Agent (qualifies yes/no).

| Property | Type | Options / Notes |
|----------|------|-----------------|
| Rule name | title | e.g. "HH Homebound" |
| Rule ID | rich_text | `VR-001` |
| Gate | select | X=Coverage, Y=Clinical, Z=Geo/Capacity |
| Tenant scope | multi_select | HH, Hospice, Both |
| Input fields | multi_select | age, dx_code, payer, zip, dnr, prognosis_months, homebound, skilled_need |
| Rule logic (pseudocode) | rich_text | |
| Pass message | rich_text | shown when qualifies |
| Fail message | rich_text | shown when not qualifies |
| Override allowed | checkbox | admin can override? |
| Audit event name | rich_text | e.g. `verification.hh_homebound.pass` |
| Regulatory cite | rich_text | e.g. `42 CFR 418.22` (hospice) |
| Test cases | relation → `VR Test Cases` | |
| Status | status | Draft, Active, Retired |
| Owner | people | Verification team lead |

### 2.3 — `VR Test Cases`

Unit-test seed cases for Verification Agent.

| Property | Type | Notes |
|----------|------|-------|
| Name | title | `HH homebound — ambulatory denial` |
| Rule | relation → `Verification Rules` | |
| Input JSON | rich_text | fixture payload |
| Expected qualifies | select | yes, no |
| Expected reason | rich_text | |
| Implemented | checkbox | test written in repo? |
| Last run | date | |

### 2.4 — `Product Backlog`

Owned by Product team. Candidates for future sprints.

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Type | select | Feature, Bug, Chore, Spike |
| Problem | rich_text | |
| Source | select | Client, Internal, Competitive, Compliance |
| MoSCoW | select | Must, Should, Could, Won't-v1 |
| Phase target | select | Phase 0..5, Post-MVP |
| Status | status | Idea, Groomed, Ready, In Sprint, Done |
| Linked Sprint row | relation → `CRM Sprint Board` | |

### 2.5 — `Design Backlog`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Surface | select | Kanban, Referral Detail, Org Scorecard, Dashboard, Settings, Mobile PWA, Verification panel |
| Status | status | Todo, Wireframe, Mockup, Dev-handoff, Shipped |
| Figma link | url | |
| shadcn components | multi_select | button, card, table, dialog, sheet, form, dropdown, tabs, badge |
| Mobile breakpoint | select | sm, md, lg, xl |
| Linked Sprint row | relation → `CRM Sprint Board` | |

### 2.6 — `Frontend Tasks`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Route | rich_text | e.g. `/referrals/[id]` |
| Components touched | multi_select | tracked as tags |
| Status | status | Todo, In Progress, Review, Done |
| Storybook | checkbox | |
| E2E covered | checkbox | |
| Linked Sprint row | relation → `CRM Sprint Board` | |

### 2.7 — `Backend Tasks`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| API path | rich_text | e.g. `POST /api/referrals` |
| Migration # | rich_text | `0001_init`, `0002_referrals` |
| Touches PHI | checkbox | triggers Compliance review |
| RLS policy changed | checkbox | |
| Unit tests | number | count |
| Status | status | Todo, In Progress, Review, Done |
| Linked Sprint row | relation → `CRM Sprint Board` | |

### 2.8 — `QA Test Runs`

| Property | Type | Options |
|----------|------|---------|
| Run name | title | `2026-04-23 Phase 0 exit` |
| Suite | select | Unit, Playwright E2E, RLS fuzz, Verification fuzz, Smoke |
| Result | select | Pass, Fail, Flaky |
| Failures | rich_text | |
| Artifact | files | video/log |
| Commit | rich_text | short SHA |
| Gate | select | PR, Phase exit, Nightly |

### 2.9 — `DevOps Infra`

| Property | Type | Options |
|----------|------|---------|
| Resource | title | `rds-crm-dev`, `ecs-crm-api-dev`, `s3-crm-docs-dev` |
| Env | select | dev, staging, prod |
| Region | select | us-west-1 (locked) |
| IaC file | rich_text | `infra/rds.tf` |
| BAA? | checkbox | |
| Cost/mo (est) | number | |
| Secrets mapped | checkbox | Doppler entry exists |
| Status | status | Planned, Provisioned, Hardened, Decommissioned |

### 2.10 — `Security Findings`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Category | select | PHI exposure, RLS bypass, Audit-log gap, Secret leak, Prompt injection, Auth bypass, Other |
| Severity | select | P0, P1, P2, P3 |
| Source | select | Agent review, SAST, Manual, Pentest |
| HIPAA ref | rich_text | `§164.312(a)(1)` |
| Commit introduced | rich_text | |
| Status | status | Open, In Progress, Fixed, Accepted-risk |
| Fix commit | rich_text | |

### 2.11 — `Data Catalog`

Schema + seed + NPPES/enrichment tracking.

| Property | Type | Options |
|----------|------|---------|
| Asset | title | `crm.referrals`, `crm.organizations`, `seed/meridian_hh.json` |
| Type | select | Table, View, Seed file, NPPES batch, Export |
| Row count | number | |
| PHI cols | multi_select | patient_initials, dx_code, payer_id, etc. |
| Encrypted | checkbox | AES-256 KMS |
| Owner | people | |

### 2.12 — `Growth & Demo`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Channel | select | Client demo, Pilot outreach, Sales deck, Case study, Internal comms |
| Status | status | Draft, Review, Approved, Sent |
| Due | date | |
| Linked artifact | url | |

### 2.13 — `Blockers`

| Property | Type | Options |
|----------|------|---------|
| Title | title | |
| Team blocked | select | same 10 as Sprint Board |
| Team owning | select | same 10 |
| Human needed? | checkbox | requires Clay/Christina decision |
| Resolved | checkbox | |
| Opened | date | |
| Resolved at | date | |
| Notes | rich_text | |

### 2.14 — `Handoff Log`

Daily end-of-cycle handoff notes (mirrors `../Christina/BrightPath_Vault/_ai-channel/chat.md` but Notion-side).

| Property | Type | Options |
|----------|------|---------|
| Date | title (ISO date) | `2026-04-22` |
| Author | select | stone, ikeem, landon, agent |
| Cycle # | number | |
| Summary | rich_text | |
| Next owner | select | |
| Commits | rich_text | SHAs |

### 2.15 — `PR Inbox`

GitHub PR mirror (populated by `notion-automations` Worker).

| Property | Type | Options |
|----------|------|---------|
| Title | title | PR title |
| PR # | number | |
| Repo | select | christina-crm, christina-crm-inspect, Christina |
| Team tag | select | TEAM-{Product,Design,Frontend,Backend,QA,DevOps,Security,Data,Growth,Verification} |
| Status | select | open, ready_for_review, changes_requested, merged, closed |
| Compliance sign-off | checkbox | required if Touches PHI |
| PR URL | url | |
| Linked Sprint row | relation → `CRM Sprint Board` | |

---

## 3 — Relations graph

```
CRM Sprint Board  ←──── (linked) ─── Product Backlog
                  ←──── (linked) ─── Design Backlog
                  ←──── (linked) ─── Frontend Tasks
                  ←──── (linked) ─── Backend Tasks
                  ←──── (linked) ─── PR Inbox
Verification Rules ←── (1-to-N) ──── VR Test Cases
```

## 4 — Seed rows for `CRM Sprint Board`

### Phase 0 (7)
- 0.1 Repo setup — Team=DevOps — P0
- 0.2 AWS infra us-west-1 — Team=DevOps — P0 — Blocked by 0.1
- 0.3 Postgres schema + RLS — Team=Backend — P0 — Blocked by 0.1, 0.2
- 0.4 WorkOS auth — Team=Backend — P0 — Blocked by 0.1
- 0.5 Vercel deploy dev — Team=DevOps — P0 — Blocked by 0.1, 0.2
- 0.6 Datadog + PHI scrub — Team=DevOps — P0 — Blocked by 0.1, 0.2, 0.5
- 0.7 Doppler secrets — Team=DevOps — P0 — Blocked by 0.1-0.6

### Phase 1 (4)
- 1.1 Referral CRUD — Team=Backend — P0 — Blocked by 0.3, 0.4, 0.5
- 1.2 Pipeline kanban UI — Team=Frontend — P0 — Blocked by 1.1
- 1.3 Referral detail page — Team=Frontend — P0 — Blocked by 1.1
- 1.4 Notes + upload shell — Team=Backend — P1 — Blocked by 1.2, 1.3

### Phase 2 (4)
- 2.1 Organization CRUD — Team=Backend — P0 — Blocked by 1.4
- 2.2 NPPES NPI lookup — Team=Data — P1 — Blocked by 2.1
- 2.3 Contact directory CRUD — Team=Backend — P1 — Blocked by 2.1
- 2.4 Org scorecards — Team=Data — P1 — Blocked by 2.2, 2.3

### Phase 3 (4)
- 3.1 Dashboard KPIs — Team=Frontend — P0 — Blocked by 2.4
- 3.2 Activity feed — Team=Frontend — P1 — Blocked by 3.1
- 3.3 Tenant switcher — Team=Frontend — P0 — Blocked by 0.4
- 3.4 RLS validation suite — Team=QA — P0 — Blocked by 3.1, 3.2, 3.3

### Phase 4 (4)
- 4.1 Responsive mobile — Team=Design — P1 — Blocked by 3.4
- 4.2 Global search pg_trgm — Team=Backend — P2 — Blocked by 3.4
- 4.3 Settings page shell — Team=Frontend — P2 — Blocked by 3.4
- 4.4 Loading/empty/error states — Team=Frontend — P1 — Blocked by 3.4

### Phase 5 (4)
- 5.1 Seed demo data — Team=Data — P0 — Blocked by 4.4
- 5.2 Email notifications SES — Team=Backend — P1 — Blocked by 4.4
- 5.3 Demo walkthrough script — Team=Growth — P0 — Blocked by 5.1, 5.2
- 5.4 Client demo handoff — Team=Growth — P0 — Blocked by 5.3

### Verification Agent (5, NEW)
- V.1 Rules schema + JSON registry — Team=Verification — P0 — Blocked by 0.3
- V.2 3-gate evaluator (X/Y/Z) — Team=Verification — P0 — Blocked by V.1
- V.3 Referral-create webhook wiring — Team=Verification — P0 — Blocked by V.2, 1.1
- V.4 Override UI + audit event — Team=Verification — P1 — Blocked by V.3, 4.4
- V.5 Qualification funnel KPI on dashboard — Team=Verification — P1 — Blocked by V.3, 3.1

## 5 — Seed rows for `Verification Rules`

| ID | Name | Gate | Tenant | Input | Pass | Fail | Cite |
|----|------|------|--------|-------|------|------|------|
| VR-001 | Medicare Part A active | X | Both | payer, patient_id | eligible | no Part A on file | 42 CFR 424 |
| VR-002 | Medi-Cal active | X | Both | payer, state=CA | eligible | not Medi-Cal covered | CA WIC §14132 |
| VR-003 | Commercial HH benefit | X | HH | payer, plan_code | covered | plan lacks HH rider | plan contract |
| VR-004 | HH Homebound | Y | HH | homebound | qualifies | patient ambulatory without restriction | 42 CFR 409.42 |
| VR-005 | HH Skilled Need | Y | HH | skilled_need_type | qualifies | no skilled need documented | 42 CFR 409.44 |
| VR-006 | Hospice Terminal dx | Y | Hospice | dx_code, prognosis_months | qualifies (≤6mo) | prognosis > 6 months | 42 CFR 418.22 |
| VR-007 | Hospice DNR preference | Y | Hospice | dnr_status | preferred | DNR not on file (soft warn) | agency policy |
| VR-008 | Service area | Z | Both | zip, tenant_zip, radius_mi | in area | outside service radius | tenant config |
| VR-009 | Dx accepted by tenant | Z | Both | dx_code, tenant_dx_panel | accepted | dx not in tenant panel | tenant config |
| VR-010 | Census capacity | Z | Both | tenant_current_census, tenant_cap | capacity available | at cap — waitlist only | tenant config |

## 6 — Skill wiring after deploy

Once hub created, update these skills to point `CHRISTINA_CRM_HUB_ID`:

- `~/.claude/skills/devteam-24-7/SKILL.md` — branch per team → Christina hub
- `~/.claude/skills/team-24-7/SKILL.md` — overlay mode for Christina CRM
- `~/.claude/skills/product-team-24-7/SKILL.md`
- `~/.claude/skills/design-team-24-7/SKILL.md`
- `~/.claude/skills/qa-team-24-7/SKILL.md`
- `~/.claude/skills/devops-team-24-7/SKILL.md`
- `~/.claude/skills/security-team-24-7/SKILL.md`
- `~/.claude/skills/data-team-24-7/SKILL.md`
- `~/.claude/skills/growth-team-24-7/SKILL.md`
- new: `~/.claude/skills/verification-team-24-7/SKILL.md` — owns V.1–V.5 cycle

Save IDs after deploy:

```
.omc/notion-hub-ids.json
{
  "hub_page_id": "...",
  "sprint_board_db": "...",
  "verification_rules_db": "...",
  "vr_test_cases_db": "...",
  "product_backlog_db": "...",
  "design_backlog_db": "...",
  "frontend_tasks_db": "...",
  "backend_tasks_db": "...",
  "qa_test_runs_db": "...",
  "devops_infra_db": "...",
  "security_findings_db": "...",
  "data_catalog_db": "...",
  "growth_demo_db": "...",
  "blockers_db": "...",
  "handoff_log_db": "...",
  "pr_inbox_db": "..."
}
```

## 7 — Deploy checklist

- [ ] Rube MCP connected + Notion OAuth ACTIVE
- [ ] Target parent page chosen (top-level in Ikeem clay's workspace)
- [ ] Agent executes: create hub page → create 15 DBs in order → seed Sprint Board (32 rows) → seed Verification Rules (10 rows)
- [ ] Capture all IDs → `.omc/notion-hub-ids.json`
- [ ] Update skill SKILL.md files with new hub ID
- [ ] Save `project_christina_crm_hub.md` memory entry
- [ ] First cycle: team-24-7 reads hub, picks step 0.1, spawns DevOps agent

## 8 — Access policy

- Agents: Notion integration token scoped to hub page only (no master hub access)
- Humans (stone / ikeem / landon): full workspace access
- Claims hub stays separate — no cross-links to avoid BAA scope creep
