# 02 — AI-Ops Architecture

**Project:** Christina CRM (product) for Meridian Home Health + Hospice (demo tenant)
**Compete against:** WellSky, Forcura, Axxess, Homecare Homebase
**User goal:** "AI contacts people + faster response time on all angles."
**Compliance posture:** HIPAA-only lean ($12–24k/yr floor). No HITRUST, no SOC 2 until contract-forced. AWS BAA covers infra. Every vendor in the PHI path must sign a BAA.
**Residency:** us-west-1 (California-only).
**Stack guardrails (LOCKED):** Hono on ECS Fargate, RDS Postgres 16 + pgvector, S3 + SSE-KMS, Bedrock Claude (Sonnet 4.6 + Opus 4.6), WorkOS, Datadog, Vercel Enterprise. No Clerk. No Supabase under Team. No Change Healthcare. Stedi for X12 when X12 appears. Inngest Enterprise for async.

---

## TREND SIGNALS — Healthcare AI 2025–2026

1. **Voice-first intake is now table stakes.** CMS's patient-experience scoring and the post-pandemic hospice referral volume spike have made phone and fax the #1 + #2 intake channels at >70% of HH/hospice agencies. Forcura is shipping fax-OCR + LLM extraction in 2025; WellSky is still on rules-based OCR. Gap = wide open.
2. **Eligibility is consolidating around Availity + Waystar after the Change Healthcare breach.** Many agencies are quietly re-papering BAAs and switching clearinghouses. Any new CRM that ships an eligibility abstraction layer that swaps between pVerify / Availity / Waystar wins procurement.
3. **TEFCA + CMS-0057-F prior-auth automation is landing in 2026.** Agencies that automate PA request packaging (F2F, OASIS, physician order, dx justification) will pull ahead. This is where doc-gen + vector-memory-per-payer compounds.
4. **Ambient AI for clinicians (Abridge, DeepScribe, Suki) has proven the pattern.** BD reps and intake coordinators are the next wave — same UX (mic on, AI drafts), different workflow (referral source visit notes, not SOAP notes).

**IMPACT** — Christina CRM's moat is not "another pipeline view." It is: (a) lowest time-to-first-touch in the industry via AI triage + auto-draft, (b) lowest cost-per-referral-processed via fax-OCR + eligibility agent, (c) highest BD-rep productivity via ambient visit capture. Three compounding loops, all shippable under a HIPAA-only posture.

**ACTION** — Phase 0 (this week) must mock all three loops in the HTML demo. Phase 1 (4–6 wks) ships fax-OCR + inbox-triage + SMS-nurture as the foundation. Phase 2 (6–12 wks) ships voice AI. Phase 3 (12–20 wks) ships eligibility + doc-gen + scheduling.

---

## 1. AI-Ops Feature Surface

Each feature below is buildable on the locked stack. Effort = S (1–3 days), M (1–2 wks), L (3–6 wks). Ordered by build sequence.

### 1.1 Inbound fax / eFax OCR → structured referral (L, Phase 1)

**User story:** As an intake coordinator, when a fax lands in the agency's eFax inbox, I want Christina to OCR it, extract patient demographics / insurance / diagnosis / referring physician, and create a draft referral with confidence scores I can approve in one click, so I never re-type a fax again.

**Trigger:** eFax webhook POSTs PDF to `/ingest/fax`. Also manual upload.

**Input:** PDF (1–12 pages typical), often mixed — face sheet + H&P + med list + F2F note + insurance card scan.

**Pipeline:**
1. S3 PUT (SSE-KMS, per-tenant key) → Textract async job for layout + text.
2. Claude Sonnet 4.6 via Bedrock with structured-output schema: `{patient, payer, diagnosis_primary, diagnosis_secondary[], referring_physician, service_requested, urgency, soc_date_requested, confidence_scores}`.
3. Confidence < 0.85 on any field → flagged yellow in UI, human must confirm.
4. Audit log entry per extraction (hash of input PDF, model version, schema version, user who approved).

**Output:** Draft referral row in `crm.referrals` with status `ai_draft`, plus a diff view showing source text → extracted field.

**Success metric:** ≥ 80% of inbound faxes auto-draft with zero coordinator edits on non-PHI fields. First-touch time drops from industry-avg ~4h to < 15 min.

**Dependencies:** S3 bucket with SSE-KMS; Textract enabled in us-west-1; Bedrock Claude Sonnet 4.6; eFax vendor with BAA (pick in §2); `crm.referrals` table + `crm.ai_extractions` audit table.

---

### 1.2 Inbound call auto-attendant (L, Phase 2)

**User story:** As an agency, when a physician's office calls our intake line after hours or when all intake coordinators are on other calls, I want an AI attendant that greets them, captures the referral details conversationally, creates a draft referral, and routes urgent cases to the on-call intake nurse's mobile.

**Trigger:** Twilio Programmable Voice `<Stream>` webhook on inbound call to tenant's intake number.

**Input:** Real-time audio (Deepgram streaming STT), caller number, tenant routing rules.

**Pipeline:**
1. Twilio `<Stream>` → Deepgram Nova-3 medical → transcript tokens to Claude Opus 4.6 system prompt ("You are Christina, intake assistant for Meridian Home Health. Never give clinical advice. Collect: caller name, caller role, patient name, patient DOB, referring MD, primary dx, service requested, preferred SOC date, callback number.").
2. TTS via Cartesia Sonic-English (low-latency, BAA available) — voice-cloned to agency's designated intake voice (consent-on-file only).
3. Urgency classifier (Haiku) — flags hospice GIP, wound-vac, IV-abx as urgent → warm-transfer to on-call nurse via Twilio dial-out.
4. Call ends → full transcript + structured draft referral saved.

**Output:** Call recording (S3 SSE-KMS, 6-yr retention), transcript, draft referral, urgency tag.

**Success metric:** ≥ 60% of after-hours calls complete without human; ≥ 95% urgent calls reach on-call nurse within 90 sec.

**Dependencies:** Twilio Voice (BAA), Deepgram (BAA), Cartesia (BAA — verify), Bedrock Claude, state-specific recording-consent disclosure at call open.

**Guardrails:** Never impersonate a real person. Voice must self-identify as AI in opening ("This is Christina, an AI assistant for…"). Two-party consent states (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA) — disclose recording at call open.

---

### 1.3 Outbound AI voice dialer (L, Phase 2)

**User story:** As an intake coordinator, when a referral is missing demographics or insurance auth, I want to click "Request info via call" and have the AI dial the physician's office, politely request the missing fields, leave a callback if unavailable, and attach a transcript to the referral.

**Trigger:** Button in referral detail → queued outbound job.

**Input:** Referral ID, missing fields list, destination number (from `crm.orgs.phone`).

**Pipeline:** Twilio Voice outbound → Cartesia TTS → Deepgram on reply → Claude Opus driving a short scripted flow with allowed-deviation tree. If IVR, DTMF nav + retry. If voicemail, leave callback script + SMS follow-up. All outbound calls disclose AI status.

**Output:** Call outcome (`answered_human`, `voicemail`, `ivr_failed`, `info_captured`, `callback_promised`), transcript, any captured fields pre-filled onto referral (still pending human approval).

**Success metric:** ≥ 40% of outbound info-gathering calls return the missing fields without a human follow-up.

**Dependencies:** Same as 1.2 + outbound-calling-hours guardrail (8 AM – 9 PM caller's local TZ, per TCPA B2B convention even though TCPA B2B exemption applies).

**Hard guardrail:** Never dial a patient or family member with AI voice in Phase 2. Physician/payer offices only. Patient/caregiver AI voice is a separate later decision.

---

### 1.4 SMS nurture sequence (M, Phase 1)

**User story:** As an agency, once a referral is accepted and the patient has given TCPA opt-in at SOC, I want Christina to send stage-appropriate SMS check-ins to the caregiver (not the patient — most are elderly) — admission confirmation, first-visit reminder, 7-day check-in, 30-day satisfaction pulse. AI personalizes tone; clinical content is templated.

**Trigger:** Referral status transitions (`accepted`, `admitted`, `visit_1_complete`, `d7`, `d30`).

**Input:** Caregiver phone, opt-in timestamp + source, referral context, tenant-approved templates.

**Pipeline:** Inngest schedule → Claude Haiku fills approved template slots (never invents content) → Twilio SMS with STOP/HELP keywords handled automatically → replies land in Conversation Inbox (§4).

**Output:** SMS sent/delivered events, reply routing, unsubscribe tracking.

**Success metric:** ≥ 25% reply rate on 7-day check-in; zero TCPA complaints.

**Dependencies:** Twilio SMS (BAA), opt-in capture flow at SOC (paper or DocuSign), STOP/HELP keyword handler, 10DLC registration for the agency brand.

**Guardrails:** No PHI in SMS body ever. Link to portal for details. TCPA calling hours 8 AM – 9 PM recipient local TZ. Opt-in proof stored immutably.

---

### 1.5 AI inbox triage (M, Phase 1)

**User story:** As an intake coordinator, when a new referral hits our inbox from any channel, I want Christina to rank it by (a) payer fit vs tenant contracted payers, (b) diagnosis fit vs tenant clinical capabilities, (c) geographic fit vs nurse capacity, (d) urgency, and route it to the right queue.

**Trigger:** New referral row with status `new`.

**Input:** Referral fields + tenant config (`contracted_payers`, `service_area_zips`, `clinical_capabilities`, `nurse_capacity_by_zip`).

**Pipeline:** Claude Haiku classifier with few-shot examples per tenant → scores (0–100) + rationale → assigned queue + priority.

**Output:** `referral.triage_score`, `referral.triage_rationale`, `referral.assigned_queue`.

**Success metric:** Coordinators accept the AI-recommended queue ≥ 85% of the time.

**Dependencies:** Bedrock Haiku, tenant config tables, `crm.referrals` queue field.

---

### 1.6 Auto-draft response (M, Phase 1)

**User story:** As an intake coordinator, after I review a triaged referral, I want a 1-click draft to send back to the referring source — "accept and propose SOC on X", "decline with reason Y", or "info-request missing Z". Draft uses agency's voice, I edit if needed, send.

**Trigger:** Button in referral detail.

**Input:** Referral + tenant email/fax templates + decision (`accept` / `decline` / `info_request`).

**Pipeline:** Claude Sonnet 4.6 with tenant-specific few-shot examples (last 20 coordinator-sent messages) → draft with subject + body + placeholder blanks highlighted.

**Output:** Draft sits in Outbound Queue (§4) pending human approval. Sends via SES (email) or Documo (fax).

**Success metric:** Median coordinator edit distance ≤ 15% of draft length.

**Dependencies:** Bedrock Sonnet, SES, fax send vendor, per-tenant template library.

---

### 1.7 Ambient BD rep call notes (M, Phase 2)

**User story:** As a BD rep, when I walk into a referring clinic to check on our relationship, I tap "Start Visit" on mobile, the mic captures the conversation, and when I tap "End Visit" Christina gives me a clean summary — topics discussed, objections raised, next actions, sentiment, and pre-fills the visit log with tagged contacts.

**Trigger:** BD mobile "Start Visit" button; geofence-confirms org address.

**Input:** Audio (on-device recording until visit end), org/contact context, rep identity.

**Pipeline:** Audio uploaded to S3 post-visit → Deepgram batch STT → Claude Sonnet 4.6 summary with schema `{topics, objections, competitive_mentions, next_actions, sentiment, contacts_mentioned}` → saved to `crm.bd_visits`.

**Output:** Visit log + summary + action items assigned to rep.

**Success metric:** ≥ 70% of BD visits logged via ambient capture (vs manual typing).

**Dependencies:** React Native mic permission + local encryption, S3, Deepgram, Bedrock Sonnet, explicit one-time rep-side consent screen + per-visit "I confirmed the other party is aware" checkbox. Two-party consent states require the rep to disclose verbally — mandatory in-app script.

**Guardrails:** Rep MUST read the disclosure script in two-party states. Audio auto-deleted after 30 days (only the structured summary + transcript retained). This is a BD-rep tool, not a clinical scribe — hard boundary.

---

### 1.8 Eligibility lookup agent (L, Phase 3)

**User story:** As an intake coordinator, when I draft a referral, I want Christina to check the patient's coverage (Medicare Part A+B, Medicaid MCO, commercial) in < 30 sec — returning active/inactive, plan details, copay, auth-required flag, and a link to the payer portal.

**Trigger:** Referral save → background job. Also manual "Re-check eligibility" button.

**Input:** Patient name, DOB, member ID (if captured), insurance scan (OCR-fed).

**Pipeline:** Adapter layer over pVerify (primary) + Availity (secondary for Medicaid MCOs) + Waystar (optional, for commercial); 270/271 EDI under the hood but abstracted. Results cached 24h keyed by `(member_id, dob)`.

**Output:** `crm.eligibility_checks` row with plan, active_dates, copay, auth_req, raw 271 stored S3.

**Success metric:** ≥ 95% of Medicare + Medicaid referrals eligibility-verified within 30 sec; ≥ 80% of commercial within 2 min.

**Dependencies:** pVerify + Availity BAAs signed, 270/271 mapping, pgvector cache.

**Why no Change Healthcare:** Breach fallout + ongoing ownership instability. Explicitly forbidden.

---

### 1.9 Doc-gen agent (L, Phase 3)

**User story:** As an intake coordinator, from an unstructured referral I want to generate a draft Plan of Care, CMS-485, F2F note, or hospice certification — clinical fields proposed by AI, always human-approved, signature workflow via DocuSign.

**Trigger:** Button on referral detail ("Generate 485", etc.).

**Input:** Referral + captured clinical fields + tenant template + state-specific form version.

**Pipeline:** Claude Opus 4.6 (clinical content needs Opus-tier reasoning) with heavy structured-output schema, every field tagged with source (extracted, inferred, human). Inferred fields flagged for clinician review. Output as HTML → PDF via Puppeteer → DocuSign envelope.

**Output:** Draft PDF + DocuSign envelope ID + field-source audit.

**Success metric:** ≥ 50% of 485s signed within 4 hours of referral accept (industry benchmark: 5–10 days).

**Dependencies:** Bedrock Opus, DocuSign (BAA), form template library per state, clinician-approval workflow (non-negotiable — AI proposes, clinician signs).

**Guardrails:** No clinical output ever goes out unsigned by a licensed clinician. Period.

---

### 1.10 Scheduling agent (M, Phase 3)

**User story:** As an intake coordinator, when a referral is accepted with a 48-hr SOC SLA, I want Christina to find the best nurse slot within that window — considering nurse specialty, current caseload, geographic cluster, and patient preferences.

**Trigger:** Referral status → `accepted` with SOC SLA.

**Input:** Nurse availability, nurse specialties, patient zip, SLA window.

**Pipeline:** In-house constraint solver (not an LLM — deterministic optimizer on availability × geo × specialty × caseload). LLM only for the UX — explaining "Why this slot?"

**Output:** Proposed SOC slot + nurse assignment. Coordinator confirms.

**Success metric:** ≥ 90% of accepted referrals scheduled within SLA on first pass.

**Dependencies:** Nurse schedule table (integrated from payroll/HR or manual), geo-distance matrix, in-house solver (`or-tools` or similar).

**Why no LLM for the solve:** Hallucination risk on scheduling = double-booking nurses. Deterministic algo is cheap and correct.

---

### 1.11 Response-time SLA monitor (S, Phase 1)

**User story:** As an intake manager, I want a live widget showing which referrals are approaching their first-touch SLA (2 hr default) and one-click escalation.

**Trigger:** Cron every 60 sec.

**Input:** `crm.referrals` with open SLA.

**Pipeline:** Simple SQL query → flagged set → WebSocket push to dashboard.

**Output:** At-risk list on dashboard, notifications to manager if > 90% of SLA elapsed.

**Success metric:** Median first-touch drops from industry ~4h to < 30 min.

**Dependencies:** None beyond existing stack.

---

### 1.12 Pattern-mining agent (M, Phase 3)

**User story:** As an agency owner, once a week I want a digest: "Kaiser South referrals down 30% MoM — root cause analysis + 3 suggested actions." AI mines referral volume by source × payer × diagnosis and flags anomalies.

**Trigger:** Weekly cron (Sunday 6 PM local).

**Input:** Trailing 90-day referral data, org-level metadata.

**Pipeline:** Pre-aggregated SQL metrics → anomaly detection (simple z-score first, ML later) → Claude Opus narrative summary → email digest + in-app Insights feed.

**Output:** Weekly Insights report. PDF + in-app.

**Success metric:** ≥ 1 action taken per week by owner based on AI insight.

**Dependencies:** 90 days of data (so starts firing at week 13 of production).

---

### 1.13 Bonus features — added after review

**1.13a Payer-mix optimizer (M, Phase 3).** Looks at accept/decline patterns and recommends which payer contracts to renegotiate or drop. Ties into pattern-mining.

**1.13b Referral source lifetime-value score (S, Phase 3).** pgvector embedding per org + rolling LTV score drives BD rep prioritization ("visit these 10 this week, skip these 5").

**1.13c AI compliance scrub on outbound (S, Phase 2).** Every AI-drafted message gets a final pre-send Haiku pass — "does this contain PHI going to a channel where it shouldn't?" Second line of defense on SMS/email.

**1.13d Physician NPI auto-lookup + credential check (S, Phase 1).** On referral intake, resolve physician by NPI against NPPES + PECOS opt-out file. Flags non-billable referring physicians before they reach intake queue.

**1.13e Duplicate/readmit detector (S, Phase 1).** Hash of (name + DOB + payer) with fuzzy match → flags "this patient was discharged 18 days ago" on new referral. Prevents double-admits + triggers readmit workflow.

---

## 2. Reference Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REFERRAL SOURCES                                                            │
│  Physician offices · Hospitals · SNFs · ACOs · Direct-to-home · Family       │
└──────────────────────────────────────────────────────────────────────────────┘
                │            │          │          │          │
          ┌─────▼──┐   ┌─────▼───┐ ┌────▼───┐ ┌───▼────┐ ┌───▼─────┐
          │  FAX   │   │ INBOUND │ │ EMAIL  │ │ PORTAL │ │  SMS    │
          │ (1.1)  │   │  CALL   │ │ / EHR  │ │ (HL7/  │ │ (1.4)   │
          │ Documo │   │ (1.2)   │ │ direct │ │  FHIR) │ │ Twilio  │
          └────┬───┘   │ Twilio  │ │   SES  │ └────┬───┘ └────┬────┘
               │       └────┬────┘ └────┬───┘      │          │
               └────────┬───┴──────┬────┴──────────┴──────────┘
                        │          │
                        ▼          ▼
          ┌──────────────────────────────────────────┐
          │  INTAKE CHANNEL NORMALIZER (Hono API)    │
          │   → crm.channel_events (append-only)     │
          └───────────────┬──────────────────────────┘
                          │
                          ▼
          ┌──────────────────────────────────────────────────────────┐
          │         AI ORCHESTRATOR (Inngest + Hono)                 │
          │                                                          │
          │  ┌─────────────┐  ┌───────────┐  ┌─────────────────┐    │
          │  │ Document AI │  │ Voice AI  │  │  LLM Triage     │    │
          │  │ (Textract + │  │ (Deepgram │  │  (Opus/Sonnet/  │    │
          │  │  Sonnet)    │  │  + Cart.) │  │   Haiku fan-out)│    │
          │  └─────────────┘  └───────────┘  └─────────────────┘    │
          │                                                          │
          │  ┌─────────────────────┐  ┌──────────────────────────┐   │
          │  │ Eligibility connectors│  │ Event bus + audit trail │   │
          │  │ (pVerify / Availity)│  │ (Postgres + S3 WORM)     │   │
          │  └─────────────────────┘  └──────────────────────────┘   │
          └───────────────┬──────────────────────────────────────────┘
                          │
                          ▼
          ┌──────────────────────────────────────────┐
          │  CRM STATE (RDS Postgres + pgvector)     │
          │   referrals · orgs · contacts · bd_visits│
          │   ai_extractions · conversations · audit │
          └───────────────┬──────────────────────────┘
                          │
                          ▼
          ┌──────────────────────────────────────────┐
          │  HUMAN REVIEWER UI (Next.js 15)          │
          │   Inbox · Pipeline · AI Console · Queue  │
          └───────────────┬──────────────────────────┘
                          │
                          ▼
          ┌──────────────────────────────────────────────────┐
          │  OUTBOUND AI + HUMAN                             │
          │  SMS (Twilio) · Email (SES) · Fax (Documo)       │
          │  Voice dial-out (Twilio + Cartesia) · DocuSign   │
          └──────────────────────────────────────────────────┘
```

### 2.1 Intake channels

| Channel | Vendor pick | BAA | Rough price | Why |
|---|---|---|---|---|
| Fax / eFax | **Documo** (primary) | Yes | $0.05–0.12/page, $50/mo base | HIPAA BAA available, modern API, reliable. Fallback = Concord (enterprise, pricier). Phaxio has BAA but smaller. eFax Corporate works but clunky API. |
| Inbound voice | **Twilio Programmable Voice** | Yes | $0.0085/min inbound + $1/mo/number | Already in the agency stack per memory; <Stream> supports bidirectional audio for real-time STT. Vonage is fine backup. Telnyx cheaper but fewer BAA-bundled features. |
| Outbound voice | Twilio | Yes | $0.013/min outbound | Same vendor keeps BAA + ops simple. |
| SMS | Twilio (primary), Telnyx (alt) | Yes | $0.0079/msg + 10DLC fees | BAA + STOP/HELP auto-handled. Telnyx is ~30% cheaper but needs more manual compliance plumbing. |
| Email intake | AWS SES | Yes (AWS BAA) | $0.10/1k | Already locked in. |
| EHR / portal direct | Redox or Particle Health | Yes | $2–4k/mo | Post-MVP. |

### 2.2 AI layers

| Layer | Vendor pick | BAA | Rough price | Why |
|---|---|---|---|---|
| STT | **Deepgram Nova-3 Medical** | Yes | $0.0077/min batch, $0.0125/min streaming | Medical-tuned, low latency, BAA standard. AssemblyAI is comparable. Whisper (OpenAI) has BAA on Enterprise but latency + vocabulary weaker for medical. Azure Speech is fine if the team wants all-Azure but we're AWS-locked. |
| TTS | **Cartesia Sonic-English** | Yes (verify current) | $0.065/1k chars | Lowest latency (<90 ms first audio), natural prosody, voice cloning with consent. ElevenLabs has BAA on Enterprise but expensive. OpenAI TTS has BAA via Enterprise. PlayHT has BAA too. Pick Cartesia for latency, keep ElevenLabs as fallback. |
| Voice orchestration | **Twilio <Stream>** + custom Hono handler | Yes | included in Twilio | Cheaper than Vapi/Retell which are great dev-UX but add a middleman without BAA guarantees at entry tier. Retell has BAA on Enterprise — consider if build velocity matters more than margin. |
| LLM (heavy) | **Bedrock Claude Opus 4.6** | Yes (AWS BAA) | ~$15 in / $75 out per 1M tokens | Locked choice. Clinical reasoning + doc-gen. |
| LLM (standard) | **Bedrock Claude Sonnet 4.6** | Yes | ~$3 in / $15 out per 1M tokens | Extraction, drafting, summarization. |
| LLM (fan-out) | **Bedrock Claude Haiku** | Yes | ~$0.80 in / $4 out per 1M tokens | Triage, classification, PHI-scrub pass. |
| Document AI (layout) | **AWS Textract** | Yes (AWS BAA) | ~$15/1k pages analyze | Already in AWS. Reducto is better on complex docs (tables, handwriting) but adds vendor + BAA. Use Textract first, escalate to Reducto if fax OCR accuracy < 90% on handwriting-heavy forms. |
| Document AI (extraction) | **Claude Sonnet 4.6 Vision** | Yes | Bedrock pricing | Runs on page images post-Textract for structured extraction. |
| Eligibility | **pVerify** (primary) + **Availity** (Medicaid MCO) | Yes | pVerify ~$0.35/check, Availity tiered | pVerify has one of the cleanest APIs + BAA. Availity is near-mandatory for Medicaid MCO reach. Waystar optional — more for commercial payers. **NOT Change Healthcare** per locked constraints. |
| Vector DB | **pgvector on RDS** | Yes (AWS BAA) | included in RDS | Don't add Qdrant/Pinecone if we don't need them. pgvector covers referral-source memory, template retrieval, similar-referral lookup. |
| Scheduling solver | **Google or-tools** (in-house) | N/A | free | Deterministic, no PHI leaves infra. |
| Event bus | **Postgres outbox + Inngest** | Yes (Inngest Enterprise) | ~$500/mo+ | Inngest Enterprise has BAA. Locked. |
| Workflow signing | **DocuSign** | Yes | ~$40/user/mo | 485s, F2Fs, consents. |
| Observability | **Datadog** with PHI scrub | Yes | ~$23/host/mo APM | Locked. PHI scrubber regex at ingestion. |

### 2.3 Data layer additions (new tables)

- `crm.channel_events` — append-only raw ingress from every channel (fax page, call recording URL, SMS body, email MIME).
- `crm.ai_extractions` — every AI run: input hash, model, prompt version, output JSON, confidence, reviewer, approval_timestamp.
- `crm.conversations` — unified thread per (referral × channel) for the Conversation Inbox UI.
- `crm.ai_queue` — outbound drafts awaiting human approval.
- `crm.eligibility_checks` — normalized eligibility results + raw 271 S3 pointer.
- `crm.bd_visit_audio` — audio pointer + transcript + summary + 30-day TTL on audio.
- `crm.agent_runs` — every AI-orchestrator invocation for audit + debugging.

All tables carry `tenant_id` and RLS policy `USING (tenant_id = current_setting('app.current_tenant')::uuid)`.

### 2.4 Guardrail services

- **PHI-scrub middleware** — Haiku pass on every outbound message → email/SMS/fax body → blocks if PHI detected in channel where it's disallowed.
- **Consent registry** — immutable per-patient record of SMS opt-in, call-recording disclosure, voice-cloning consent. All timestamped + signed-URL evidence.
- **BAA registry** — every vendor in the PHI path with BAA execution date, scope, renewal.
- **Audit log** — append-only, 6-yr retention, per HIPAA §164.316. Postgres + S3 WORM backup.

---

## 3. Build Sequence

### Phase 0 — Demo rework (THIS WEEK, no backend)

**Goal:** Mockup sells the AI vision. Zero backend changes. All AI behavior is scripted pseudo-interactive in the HTML.

**Deliverables:**
1. New sidebar nav entries: **AI Console**, **Conversations**, **Outbound Queue**. (See §4.)
2. Dashboard gets: SLA widget, AI activity feed, top 3 AI-draft referrals awaiting approval.
3. Inbox view gets: triage score badge per referral, "AI extracted" chips on fields with confidence %.
4. Referral-detail gets: **Next Best Action** card (AI suggestion), AI-draft response composer, eligibility strip.
5. BD-mobile gets: "Start Visit" ambient-capture modal (mock waveform + post-visit summary card).
6. AI Console (new view) shows live agent activity log + global pause/takeover.
7. Phone-bot transcript modal — scripted live transcript playback tied to an inbound-call card in inbox.
8. Outbound Queue view — list of AI-drafted SMS/email/fax awaiting approval, with approve/edit/reject.
9. Conversation Inbox — unified timeline per contact (fax/call/SMS/email interleaved).

**Acceptance criteria:**
- All 9 additions are click-through-able in the static HTML (no live API).
- Every AI-generated artifact in the mockup is labeled "AI-drafted, pending approval."
- Brand stays Christina CRM / Meridian demo.
- GitHub Pages deploy re-green.

**Cost:** $0 additional. ~2–3 days of a single frontend engineer.
**Team:** 1 frontend.

---

### Phase 1 — Foundational AI-ops (weeks 1–6, post-demo)

**Features shipped:** 1.1 Fax-OCR · 1.5 Inbox Triage · 1.4 SMS Nurture · 1.11 SLA Monitor · 1.6 Auto-draft response · 1.13d NPI lookup · 1.13e Duplicate detector.

**Why these together:** They compound. Fax-OCR feeds triage; triage routes; auto-draft closes the loop; SLA monitor measures the win; SMS nurture extends engagement; NPI + duplicate are cheap table-stakes trust-builders. Every minute saved here is visible to the buyer on day 1.

**Deliverables:**
- Documo integration + S3 ingest pipeline + Textract + Sonnet extraction.
- `crm.ai_extractions` + `crm.ai_queue` + `crm.conversations` schemas with RLS.
- Inngest workflows for triage + SMS sequence.
- Twilio SMS 10DLC registration per tenant.
- UI: real versions of AI Console, Conversation Inbox, Outbound Queue, triage chips.
- Consent capture flow (paper + DocuSign variants).
- PHI-scrub middleware in outbound path.
- Observability dashboards for extraction confidence, triage acceptance, SLA compliance.

**Acceptance criteria:**
- 100 real referrals processed end-to-end on a pilot tenant.
- ≥ 80% of faxes auto-draft without coordinator edit on non-PHI fields.
- Median first-touch time < 30 min during business hours.
- Zero PHI leaks into logs (Datadog scrubber verified).
- Pilot tenant signs continuation at end of Phase 1.

**Cost (rough):**
- Vendor OpEx: Documo ~$200/mo + Twilio SMS ~$150/mo + Bedrock ~$600/mo on 100 referrals/wk + Inngest ~$500/mo + Datadog already budgeted = **~$1,500/mo per tenant**.
- Build: 2 full-stack engineers × 6 weeks = ~$60–80k.

**Team:** 2 full-stack, 1 part-time clinical SME, 1 part-time compliance reviewer.

---

### Phase 2 — Voice AI (weeks 7–18)

**Features:** 1.2 Inbound attendant · 1.3 Outbound dialer · 1.7 Ambient BD notes · 1.13c AI compliance scrub (expanded).

**Deliverables:**
- Twilio <Stream> + Deepgram streaming + Cartesia TTS + Opus orchestration.
- Voice consent disclosure scripts per state (50-state matrix).
- Outbound dial scheduler w/ calling-hour guardrails.
- BD mobile ambient-capture (React Native + on-device encryption).
- Recording retention policies (audio 30-day for BD visits, 6-yr for intake calls).
- AI Console expanded — live transcript + barge-in takeover.

**Acceptance criteria:**
- ≥ 60% of after-hours calls complete without human.
- ≥ 70% of BD visits logged via ambient capture.
- 100% of outbound calls self-identify as AI.
- Zero recording-consent complaints.
- Voice calls pass a third-party compliance review (contract trigger only — otherwise internal review).

**Cost:**
- Vendor OpEx: Deepgram ~$400/mo + Cartesia ~$250/mo + Twilio Voice ~$500/mo = **~$1,200/mo per tenant** on top of Phase 1.
- Build: 2 full-stack + 1 voice specialist × 12 weeks = ~$180–220k.

**Team:** 3 engineers (add voice-AI specialist), 1 clinical SME, 1 compliance.

---

### Phase 3 — Eligibility + Doc-gen + Scheduling (weeks 19–38)

**Features:** 1.8 Eligibility · 1.9 Doc-gen · 1.10 Scheduling · 1.12 Pattern-mining · 1.13a Payer-mix optimizer · 1.13b Referral LTV.

**Deliverables:**
- pVerify + Availity integrations + 270/271 adapter layer.
- Doc-gen templates for 485 / F2F / hospice cert (all 50 states × 2 verticals).
- DocuSign envelope flow + clinician approval gate.
- or-tools scheduler + nurse availability sync.
- Weekly Insights digest generator.
- Embeddings index for orgs + payers.

**Acceptance criteria:**
- ≥ 95% Medicare/Medicaid eligibility verified in < 30 sec.
- ≥ 50% of 485s signed within 4 hours of referral accept.
- ≥ 90% of accepted referrals scheduled within SLA on first pass.
- Weekly Insights delivered every Sunday without human intervention.

**Cost:**
- Vendor OpEx: pVerify ~$400/mo + Availity ~$300/mo + DocuSign ~$400/mo = **~$1,100/mo per tenant** on top of Phase 1+2.
- Build: 2–3 full-stack × 20 weeks = ~$280–340k.

**Team:** 3 engineers, 1 clinical SME (heavier clinical involvement for forms), 1 compliance, 1 RCM/eligibility SME.

---

## 4. Demo-Mockup Mapping (Phase 0 delivery)

Current HTML has 8 views: dashboard, inbox, pipeline, referral-detail, orgs, reports, bd-mobile, settings.

### 4.1 New views to add (4)

**V9 — AI Console** (new sidebar entry). Sections: live agent activity feed (stream of agent_runs), global pause/takeover toggle, per-feature enable/disable, confidence threshold sliders, escalation rules editor, today's stats (calls handled, drafts generated, PHI-scrubs fired).

**V10 — Conversation Inbox** (new sidebar entry). Unified per-contact timeline: fax | call | SMS | email interleaved chronologically. Click a thread → right panel shows full context + linked referrals + AI suggestion card.

**V11 — Outbound Queue** (new sidebar entry). Cards for each AI-drafted outbound item (SMS, email, fax, voicemail script). Approve | Edit | Reject actions. Filters by channel + priority + age.

**V12 — Phone Bot Live Transcript** (modal, triggered from inbox card). Live transcript streaming + urgency badge + "take over" button + post-call structured draft preview.

### 4.2 AI affordance additions to existing views (≥ 10)

1. **Dashboard → SLA widget.** Real-time first-touch SLA gauge, at-risk referrals list.
2. **Dashboard → AI activity feed.** Last 10 AI actions (extractions, drafts, calls answered).
3. **Dashboard → Today's AI wins.** "Saved 4.2h of coordinator time · 12 faxes auto-drafted · 3 calls answered after hours."
4. **Inbox → Triage score column.** 0–100 per referral, color-coded.
5. **Inbox → "AI extracted" confidence chips** on field values (green ≥85%, yellow 60–84%, red <60%).
6. **Inbox → Unified channel icons** (fax / call / SMS / email) per referral row.
7. **Pipeline → Next-Best-Action indicator** per card ("Call Dr. Patel re: F2F missing").
8. **Referral-detail → Next Best Action card.** Top-most panel. AI suggestion + 1-click execute.
9. **Referral-detail → AI-draft response composer.** 3 buttons: Accept draft · Decline draft · Info-request draft.
10. **Referral-detail → Eligibility strip.** Payer active/inactive + copay + auth-req, with "last checked" timestamp.
11. **Referral-detail → Extraction provenance.** Hover any field → shows the fax region it was extracted from.
12. **Orgs → LTV score + next-visit recommendation** per org.
13. **BD-mobile → Start Visit modal** with mock waveform + live topic tags + post-visit summary.
14. **Reports → AI Insights tab.** Weekly pattern-mining narrative.
15. **Settings → AI Governance panel.** Per-feature on/off, confidence thresholds, BAA registry viewer, consent audit.

### 4.3 HTML implementation notes (for the Phase 0 build)

- Every AI output labeled with an `AI-drafted · pending approval` pill in Christina brand teal.
- Use scripted `setTimeout` sequences to simulate live agent activity in AI Console.
- Mock phone-bot transcript as a pre-written JSON array that prints one token every 40ms for the "live" illusion.
- No real PHI. Use the standard fake MRNs (48210, 48211) and initials-only patients from the test-data convention.
- Keep file single-HTML for GitHub Pages deploy. No build step. Tailwind via CDN as today.

---

## 5. Risks + Guardrails

### 5.1 Compliance risks

| Risk | Mitigation |
|---|---|
| **TCPA violation (SMS/voice outside hours, no opt-in)** | Hard-coded calling-hour window 8 AM – 9 PM recipient local TZ. Immutable consent registry. STOP/HELP auto-handled. Outbound queue enforces opt-in check before send. |
| **HIPAA minimum-necessary breach via LLM over-disclosure** | AI receives only the fields needed per task (row-level field allowlist per AI feature). No full-record dumps into prompts. PHI-scrub pass on outbound. |
| **42 CFR Part 2 (substance-use diagnosis)** | If referral contains a Part 2 dx (F1x codes or Part 2 facility source), feature-gate AI off for that referral until explicit re-consent. Flag at ingestion. |
| **State recording-consent (one-party vs two-party)** | Two-party state matrix built in; mandatory disclosure script at call open for CA/FL/IL/MD/MA/MT/NV/NH/PA/WA. BD ambient capture requires in-app "other party aware" confirm in two-party states. |
| **BAA chain gaps** | BAA registry with renewal alerts. Any vendor without BAA cannot be added to the production pipeline — enforced via `vendor_registry` config + CI check. |
| **Voice cloning / social engineering misuse** | AI voices must self-identify as AI on open. No cloning of any voice without written consent on file. No patient-facing AI voice in Phase 2 (physician/payer offices only). |

### 5.2 Clinical risks

| Risk | Mitigation |
|---|---|
| **Hallucination on clinical output** | AI proposes, human (licensed clinician) signs on all clinical documents. Doc-gen outputs always draft-only until clinician signature via DocuSign. Never auto-send a clinical doc. |
| **Misclassified urgency leads to missed GIP admit** | Inbound attendant urgency classifier has high-recall tuning (false positives OK, false negatives not). All after-hours calls also logged for next-AM human review. |
| **Eligibility returns stale data** | 24h cache max. "Last checked" timestamp visible in UI. Critical pre-auth decisions re-check before submission. |
| **OCR mis-extraction on handwriting** | Textract confidence gates + Reducto fallback for <85% confidence pages. Always show source-region highlight for human verification. |

### 5.3 Operational risks

| Risk | Mitigation |
|---|---|
| **Vendor outage (Twilio, Documo, Bedrock)** | Documented degradation paths: voice → fall back to human on-call; fax → retry queue + manual email alert; Bedrock → Sonnet ⇄ Opus swap, no fallback to non-BAA provider. |
| **Cost runaway on LLM/voice** | Per-tenant monthly AI spend cap. Haiku fan-out for anything that doesn't need Opus. Usage dashboards. |
| **Datadog PHI leak** | Scrubber regex tested weekly. All log fields go through `redactPHI()` helper. Never log raw request bodies in PHI paths. |
| **Inngest workflow regression dropping jobs** | Dead-letter queue + Datadog alert on retry count > 3. Every AI-orchestrator run has a row in `crm.agent_runs` — replay tool on failure. |

### 5.4 Business risks

| Risk | Mitigation |
|---|---|
| **Buyer skepticism — "your AI will hallucinate on my clinical data"** | Default governance stance: AI drafts, humans approve. Show the approval UI prominently in sales demos. Publish extraction-accuracy SLAs per release. |
| **Competitor (Forcura) ships fax-OCR first** | Speed. Phase 1 in 6 wks. Differentiate on inbox triage + auto-draft closing the loop, not OCR alone. |
| **Compliance-heavy buyer demands HITRUST/SOC 2** | Escalate to pricing tier adjustment + explicit contract-funded compliance work. Do not pre-spend on frameworks without a signed deal triggering them. |

---

## Appendix A — AI feature to data-table index

| Feature | Primary tables touched |
|---|---|
| 1.1 Fax-OCR | referrals, channel_events, ai_extractions, conversations |
| 1.2 Inbound call | channel_events, conversations, agent_runs, referrals |
| 1.3 Outbound dialer | ai_queue, agent_runs, conversations |
| 1.4 SMS nurture | ai_queue, conversations, consent_registry |
| 1.5 Inbox triage | referrals, agent_runs |
| 1.6 Auto-draft | ai_queue, agent_runs |
| 1.7 BD ambient | bd_visits, bd_visit_audio, agent_runs |
| 1.8 Eligibility | eligibility_checks, referrals |
| 1.9 Doc-gen | documents, ai_extractions, docusign_envelopes |
| 1.10 Scheduling | schedule_slots, referrals |
| 1.11 SLA monitor | referrals |
| 1.12 Pattern-mining | insights_reports, referrals (aggregate) |

## Appendix B — Model routing policy

| Task | Model | Rationale |
|---|---|---|
| Fax extraction | Sonnet 4.6 | Balance accuracy + cost on structured extraction |
| Clinical doc-gen | Opus 4.6 | Clinical reasoning quality non-negotiable |
| Triage / classification | Haiku | Speed + cost; confidence threshold gates escalation |
| Voice orchestration | Opus 4.6 | Conversational latency OK; reasoning matters |
| PHI-scrub pass | Haiku | High-throughput, low-complexity check |
| Pattern-mining narrative | Opus 4.6 | Weekly, quality matters more than speed |
| Response drafting | Sonnet 4.6 | Good tone fit, cheaper than Opus |

## Appendix C — Glossary

- **SOC** — Start of Care (first visit by clinician post-admission).
- **F2F** — Face-to-Face encounter (Medicare-required physician encounter within 90 days pre / 30 days post SOC for HH).
- **485** — CMS-485 Plan of Care.
- **GIP** — General Inpatient (hospice level of care).
- **OASIS** — Outcome and Assessment Information Set (HH required clinical data set).
- **10DLC** — 10-digit long-code registration for business SMS in the US.
- **TEFCA** — Trusted Exchange Framework and Common Agreement (ONC interop).
- **CMS-0057-F** — CMS Interoperability + Prior Auth rule.
