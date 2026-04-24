# 00 — Game plan: Christina CRM at parity + AI moats

**Dated:** 2026-04-23
**Scope:** Rework live demo at https://aidegens.github.io/christina-crm/ to match Waystar/Forcura/WellSky parity + ship 3 AI moats competitors cannot clone cheaply.

## Inputs (all in `Plans/demo-rework/`)

- `01-competitive-teardown.md` — 8-vendor teardown, feature parity matrix, pilot blockers, AI moats
- `02-ai-ops-architecture.md` — AI-ops feature spec, vendor picks, phase gates
- `03-tech-stack.md` — Vendor contracts, data model additions, cost model, rollout
- `04-regulatory-memo.md` — TCPA, HIPAA, CIPA, 42 CFR Part 2, FCC 24-28, state recording consent

## Strategy

Christina = **AI-ops layer on an enterprise-grade CRM**. Not a pretty dashboard. Three market pillars:

1. **Parity with incumbents** — removes "we need to keep WellSky for X" objections
2. **Response-time compression** — measurable SLA dashboard proves the pitch
3. **Referral-source intelligence** — physician scoreboard + BD loop moat competitors are blind to

## Top 5 pilot-blockers (from teardown)

1. **EHR read-write integration** — agencies won't pay for two systems
2. **Fax → structured referral summary** — Claude reads packet, produces 2-page intake summary
3. **Referral scoring + auto-route** — incumbents shipped 2025, now table-stakes
4. **Hospice LOS alerts + Face-to-Face tracker** — CMS GIP audit fear
5. **Physician scoreboard** — referral quality analytics

## Top 3 AI moats (build first — S-size each)

1. **Auto-thanks note to referring physician** — BD loop nobody else has
2. **Fax duplicate detector** — embeddings, kills 20-30% noise
3. **Physician yield narrative card** — data already in model, competitors blind

## Mockup rework scope (ship today)

### 4 new top-level views
- **AI Console** — live agent activity, human takeover controls, shadow/assist/auto state per template
- **Conversation Inbox** — unified multi-channel thread (fax / voice / SMS / email) per contact
- **Outbound Queue** — AI drafts awaiting human Send, filter by channel + urgency
- **Phone Bot transcript modal** — live STT + AI turn highlighting + interrupt button

### Dashboard additions
- SLA widget (p50/p99 inbox-to-first-touch, current vs 30d trend)
- AI activity feed (last 10 AI decisions, approve/edit/reject counters)
- "Today's AI wins" card (drafts sent, minutes saved, duplicate faxes killed)
- Physician scoreboard widget (top 5 referring docs by yield)

### Inbox enhancements
- Triage score column (0-100, AI-confidence chip)
- Channel icons per row (fax/voice/SMS/email/web)
- Extraction confidence chip on AI-populated rows
- Duplicate-fax pair indicator

### Referral-detail enhancements
- **Next Best Action** AI suggestion card (top of right rail)
- AI-draft response composer (tabs: SMS / email / voice-VM / fax)
- Eligibility strip (Stedi 270/271 result + coverage window + auth-required flag)
- Extraction provenance hover (field → source page + confidence)
- Physician thank-you auto-draft button
- Hospice LOS warning banner (if applicable) + Face-to-Face tracker

### BD mobile additions
- Start Visit ambient-capture modal (fake waveform + live transcript preview + post-visit AI summary)
- Referring-physician one-tap call/SMS from org card

### Compliance affordances (from regulatory memo — MUST show)
- **Consent-required badge** on every outbound AI control — disabled state when no consent row
- **State-aware recording disclosure script** pre-filled on outbound voice modal (CA two-party language)
- **Supervised Mode toggle** visible on every AI surface — default ON ("AI drafts, you send")
- FCC 24-28 AI-disclosure banner on voice agent config ("This is an AI voice — required disclosure")
- TCPA opt-in/opt-out fields visible on contact record
- Audit-log chip on every AI-generated message row

### Do NOT build (per legal memo)
- AI voice that impersonates a named clinician
- Auto-send SMS/voice without explicit per-template tenant opt-in after 30-day agreement metrics
- Any AI that finalizes clinical POC/485/hospice cert without nurse signature

## Deploy

- Push to `feat/crm/ikeem-initial-import` — GitHub Actions pages.yml auto-redeploys
- URL stays: https://aidegens.github.io/christina-crm/
- Synthetic data only — `data-demo="true"` markers preserved on all PHI-shaped rows
- No real PHI, no real patient names, no real NPIs (use `1XXXXXXXX9` pattern, `DEMO-####` MRN)

## Phase 1 (post-demo, 12-16 weeks) build order

Per `03-tech-stack.md`:
1. Fax → referral (weeks 1-4) — Documo + Bedrock Vision + Textract fallback
2. Inbox triage + SLA engine (weeks 4-8) — `conversations` tables + AI-drafted replies
3. Voice agent (weeks 8-14) — Twilio Media Streams + Deepgram + Haiku + Polly

## Phase 0.5 spike (before Phase 2 voice)

- Twilio + Deepgram + Cartesia + Opus round-trip latency benchmark. Budget: 1.2s target; 2s blow-up triggers LiveKit Agents fallback.
- Chime Voice Connector parallel spike to derisk Twilio $250/mo floor.

## BAAs required before ANY AI outbound message goes live

1. AWS (free, click-sign in AWS Artifact)
2. WorkOS (free, email support)
3. Bedrock (inherits AWS BAA — done)
4. Deepgram (Growth plan OR PAYG w/ email BAA)
5. Twilio (Enterprise $250/mo floor)
6. Documo (Pro $79/mo)
7. Stedi (included on paid tier)

**Counsel trigger:** first paid pilot contract, first live AI outbound message, first recorded call in 2-party state, first breach indicator.

## Success metrics (pilot agency, 60 days)

- Inbox-to-first-touch p50 reduction ≥40% vs WellSky baseline
- Fax-OCR accuracy ≥92% field-level
- Human-approved-no-edit rate ≥85% by day 30 for AI drafts
- Duplicate-fax detection ≥15% of monthly inbound volume
- Physician thank-you response rate ≥30% (new BD signal)
- Zero TCPA / HIPAA / CIPA violations

## Risk register (consolidated)

- Twilio $250 cash burn pre-revenue → Chime Voice Connector fallback spike
- Voice round-trip latency blow-up → LiveKit Agents fallback
- PHI leaks to LLM logs → scrubber decorator + weekly synthetic injection test
- Auto-send regression → per-template kill switch, opt-in after 30d metrics
- BAA gap → CI check on new vendor adapters
- Deepgram SLA breach → Amazon Transcribe Medical hot failover
- Cross-tenant data leak → per-tenant KMS CMK + RLS enforced + audit every decrypt

## Next

1. Designer rework hh-crm-mockup.html — this cycle
2. Push → auto-deploy
3. User reviews live URL
4. Round-2 polish if needed
5. Phase 1 engineering kickoff → seed DEV-* backlog in Notion Christina CRM hub
