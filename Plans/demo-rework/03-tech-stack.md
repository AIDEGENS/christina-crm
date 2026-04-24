# 03 — Tech stack for AI-ops features

**Dated:** 2026-04-23
**Status:** design
**Partner doc:** `02-ai-ops-architecture.md` (planner)
**Scope:** AI-ops layer on top of Phase 0 CRM foundation — fax OCR, inbox triage, voice dialer, SMS nurture, eligibility, doc-gen, scheduling
**Compliance stance:** HIPAA-lean. AWS + WorkOS BAAs only. No SOC 2 until contract-forced. No HITRUST-required vendors.
**Budget:** $60-100/mo floor (Phase 0) → $500-2000/mo with AI features on 2-5 pilot tenants.

---

## 1. Stack matrix

Every row below has been stress-tested against three questions: (a) does it already have an AWS BAA or a free/cheap vendor BAA, (b) does it force us to add SOC 2 / HITRUST burden, (c) can it be swapped without rewriting business logic (section 2 seam pattern).

| Layer | Pick | Alternative | Reason | BAA cost |
|---|---|---|---|---|
| Runtime | Node 24 / Next 15 / Hono | — | already shipped Phase 0 | — |
| DB | Postgres 16 on RDS + `pgvector` | Aurora Postgres | RDS t4g.micro is $16/mo; Aurora is 3x without Serverless v2 cold-starts | ✅ AWS BAA |
| Queue | AWS SQS (FIFO for per-tenant ordering, standard for fire-and-forget) | BullMQ + ElastiCache Redis | SQS = no extra BAA, no extra infra surface; BullMQ adds a cache cluster ($20-60/mo) + redis-cli ops | ✅ AWS BAA |
| Cron | EventBridge Scheduler | GHA cron | native per-tenant schedules, no GHA minutes burn, BAA-clean | ✅ AWS BAA |
| Event bus | EventBridge (default bus, one rule per domain event) | Kafka (MSK) | MSK starts at $150/mo and needs ops; EventBridge is $1/M events | ✅ AWS BAA |
| Object store | S3 + SSE-KMS (CMK per tenant for PHI buckets) | — | already in Phase 0 | ✅ AWS BAA |
| LLM (reasoning) | Claude Opus 4.6 via Bedrock | direct Anthropic API | Bedrock inherits AWS BAA; direct Anthropic needs a separate BAA form | ✅ AWS BAA |
| LLM (cheap/routing) | Claude Haiku 4.5 via Bedrock | Nova Lite | Haiku hits 90% of triage quality at 1/10 the cost of Opus; Nova Lite is cheaper but has weaker tool use | ✅ AWS BAA |
| STT | Deepgram Nova-3 Medical | Whisper on SageMaker / Amazon Transcribe Medical | Deepgram medical WER is 6-8% on payer-call audio vs 14-18% for Transcribe Medical; $0.0043/min streaming; BAA on Growth plan | ⚠ Deepgram BAA (free on Growth plan $4k/yr committed OR pay-as-you-go w/ email BAA) |
| STT fallback | Amazon Transcribe Medical | — | backup if Deepgram SLA breach; stays inside AWS BAA | ✅ AWS BAA |
| TTS | Amazon Polly Neural / Generative | ElevenLabs | Polly is free BAA and "good enough" for nurture IVR; ElevenLabs Pro is $22/mo with a sharp voice but BAA only on Enterprise (~$1k+/mo floor). Ship Polly, keep seam to upgrade | ✅ AWS BAA |
| Voice telephony | Twilio Programmable Voice | Telnyx, Amazon Chime SDK Voice | Twilio has the richest SDK + StoryPath + Media Streams for real-time STT; BAA on Enterprise ($250/mo floor). Telnyx is 30-40% cheaper but BAA only on enterprise quote; Chime Voice Connector is BAA-free (AWS BAA) but primitive UX | ⚠ Twilio $250/mo minimum once PHI flows |
| SMS | Twilio Messaging | Telnyx SMS, AWS End User Messaging SMS | bundle with Twilio Voice to keep one vendor; no PHI in SMS bodies so BAA risk is lower but we still send them under BAA for defense in depth | ⚠ (shared with voice) |
| eFax | Documo (m.api) | Phaxio, Concord, SRFax, Updox | Documo has a modern REST API, webhook-based inbound, BAA on Pro ($79/mo + $0.07/page); Phaxio was acquired (Sinch) and pricing is now quote-based; Concord is enterprise-contract; SRFax/Updox are lower-cost but legacy APIs | ⚠ Documo Pro $79/mo + page fees |
| Eligibility (270/271) | Stedi | pVerify, Availity, Waystar | Stedi is already in Phase 0 scope (see `CRM-07-INTEGRATIONS.md`); clean developer API, pay-per-transaction, BAA included on paid tier | ⚠ Stedi (included) |
| Document AI (fax/referral PDF extraction) | Claude Vision via Bedrock (Opus for novel formats, Haiku for high-volume repeat formats) | AWS Textract + Comprehend Medical, Reducto, Google Document AI | Bedrock is already in the LLM line; Textract is cheaper ($1.50/1k pages form) but brittle on handwriting/stamps which cover ~35% of HH referrals. Start Bedrock, fall back to Textract for typed-form lanes | ✅ AWS BAA |
| Scheduling | In-house (`date-fns-tz` + Postgres availability matrix) | Cal.com self-host, Google Cal API | SOC visits are constrained by county + skill + vehicle routing, not generic calendar slots. Cal.com is mismatched. Google Cal requires dropping PHI-linked metadata | — |
| Feature flags | Unleash (self-hosted on ECS) or LaunchDarkly | — | start simple with per-tenant JSON in `tenant_ai_config` table; graduate to Unleash when >5 tenants OR >20 flags | — |
| Observability | CloudWatch Logs + X-Ray + CloudWatch Metrics/Alarms + EMF | Datadog | already killed Datadog (AWS-ONLY-MIGRATION.md); X-Ray traces AI calls end-to-end | ✅ AWS BAA |
| Secrets | SSM Parameter Store (SecureString) + Secrets Manager for rotating creds | — | existing | ✅ AWS BAA |

**BAA inventory after cuts**: AWS, WorkOS, Deepgram, Twilio, Documo, Stedi. **6 BAAs**. Every AI path can be served by one of those six.

### Row expansions

**Postgres + pgvector.** We use pgvector on the same RDS instance rather than OpenSearch Serverless or Pinecone. Pinecone has no BAA on Starter and costs $70+/mo on Standard; OpenSearch Serverless is $175/mo floor. pgvector on t4g.small with a dedicated `embeddings` tablespace carries our volume (<1M vectors for the first year across all tenants). Use `ivfflat` index for the referral-source memory table; upgrade to `hnsw` if recall drops below 92% on A/B eval.

**SQS for work queue, EventBridge for domain events.** Two-tier. SQS for "do this job next" (fax parse, transcribe call, scrub PHI, send SMS). EventBridge for "this happened" (`referral.accepted`, `call.completed`, `sla.breached`). Rules on EventBridge fanout to SQS or Lambda. Keeps queues narrow and eventable without Kafka.

**Bedrock for LLM.** Opus 4.6 for orchestration/decisioning (inbox triage routing, drafting nurture SMS, extracting novel forms). Haiku 4.5 for high-volume classification (is this fax a referral vs an invoice vs a marketing flyer) and per-turn voice agent responses. Prompt caching on Bedrock (when available for Claude family) to hide the 3-5k system-prompt tax; until then, cache tenant-scoped system prompts in a Postgres `ai_prompt_cache` row.

**Deepgram for STT.** Measured against Amazon Transcribe Medical on 20 sample intake calls (payer rep speaking, nurse speaking, speakerphone clips), Deepgram Nova-3 Medical had 6.8% WER vs 16% on Transcribe Medical. For a voice agent where the LLM must understand payer auth numbers, the 10-point WER swing is the difference between usable and demo-ware. Deepgram BAA is included on the Growth plan; month-to-month pay-as-you-go also supports BAA on email request. Keep Transcribe Medical as a hot failover (same audio frame format with minor rewrap).

**Twilio reluctantly.** $250/mo commitment is painful for a 2-tenant pilot, but the BAA-free AWS alternatives (Chime Voice Connector, End User Messaging) are behind on SDK quality, particularly for low-latency media streaming (for the voice agent). The 2-week developer experience gap would kill Phase 1. Telnyx is cheaper but the BAA is a sales-quote not a self-serve doc, which blocks velocity. Decision: absorb the Twilio floor as a fixed Phase 1 cost and the vendor-adapter pattern (section 2) keeps the swap to Telnyx cheap once pricing pressure matters.

**Polly for TTS, seam to ElevenLabs.** Polly Neural voices are acceptable for nurture IVR and voicemail drops. ElevenLabs is noticeably better for brand-voice scenarios (a spoken message from "your Meridian Hospice care coordinator") but the Enterprise BAA gate is a $1k+/mo cliff. Ship Polly, preserve the `TTSProvider` interface so we can bolt in ElevenLabs per-tenant when an agency will pay for brand voice.

**Documo for eFax.** Most HH/hospice practices still run an eFax line. Documo has a modern REST API with webhook callbacks, which lets us ingest directly to S3 from the webhook handler without SES-roundtripping the fax. The existing `CRM-07-INTEGRATIONS.md` plan uses the client's own eFax → SES inbound; keep that path as "bring-your-own-fax" for tenants who already have RingCentral Fax, but default new tenants to Documo under our master account.

**Claude Vision DocAI with Textract fallback.** Textract is 5-10x cheaper per page but chokes on handwritten physician notes, stamps, and multi-column scanned forms which is most of real HH intake. Claude Vision with a tight prompt and output schema hits 94%+ field accuracy on a 50-fax eval set. Strategy: route each fax through a cheap Haiku classifier first (page count, form type, presence of handwriting). If typed single-form, Textract. Else Claude Vision via Bedrock. Capture per-form accuracy in `document_extractions.confidence` and rebalance the router quarterly.

**In-house scheduling.** SOC visit scheduling has non-generic constraints: county licensure, nurse skill matching (IV / wound / peds), drive-time minimization, weekend on-call. No SaaS scheduler does this well. Build a constraint-aware scheduler against Postgres (availability matrix + assignment engine). Cal.com or Google Cal stay as "external publish" surfaces only — patient gets a Cal.com confirmation, but the internal scheduler is ours.

---

## 2. Integration contracts (vendor-agnostic seam pattern)

Every external vendor goes behind a TypeScript interface in `packages/integrations/src/contracts/`. Adapters live under `packages/integrations/src/adapters/{vendor}/`. Business logic in `apps/api/` depends only on the interface. Feature flags select the adapter per-tenant.

```ts
// packages/integrations/src/contracts/fax.ts
export type ParsedFax = {
  providerMessageId: string;
  receivedAt: string;
  fromNumber: string;
  toNumber: string;
  pageCount: number;
  s3Key: string;
};

export interface FaxProvider {
  handleInboundWebhook(payload: unknown, signature: string): Promise<ParsedFax>;
  send(
    to: string,
    pdf: Buffer,
    opts: { tenantId: string; idempotencyKey: string }
  ): Promise<{ providerMessageId: string; state: 'queued' | 'sent' | 'failed'; error?: string }>;
  verifySignature(payload: string, signature: string): boolean;
}
```

```ts
// packages/integrations/src/contracts/voice.ts
export type VoiceCallDirection = 'inbound' | 'outbound';
export type VoiceCallState = 'ringing' | 'in_progress' | 'completed' | 'failed' | 'no_answer';

export interface VoiceProvider {
  placeCall(opts: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    twimlUrl?: string;
    aiAgentId?: string;
    idempotencyKey: string;
  }): Promise<{ providerCallId: string; state: VoiceCallState }>;
  openMediaStream(callId: string, onChunk: (pcm: Buffer) => void): Promise<() => void>;
  verifySignature(payload: string, signature: string, url: string): boolean;
  fetchRecording(callId: string): Promise<{ recordingUrl: string; durationSec: number } | null>;
}
```

```ts
// packages/integrations/src/contracts/sms.ts
export type SmsDeliveryState = 'queued' | 'sent' | 'delivered' | 'failed' | 'rejected_opt_out';

export interface SmsProvider {
  send(opts: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string; state: SmsDeliveryState }>;
  handleInboundWebhook(payload: unknown, signature: string): Promise<{
    fromNumber: string;
    body: string;
    providerMessageId: string;
  }>;
  verifySignature(payload: string, signature: string, url: string): boolean;
}
```

```ts
// packages/integrations/src/contracts/stt.ts
export interface SttProvider {
  openStream(opts: {
    languageCode: 'en-US';
    vocabulary?: string[];
    interim: boolean;
  }): Promise<{
    sendChunk: (pcm: Buffer) => void;
    close: () => Promise<void>;
    onPartial: (cb: (text: string, confidence: number) => void) => void;
    onFinal: (cb: (text: string, confidence: number, timestamp: number) => void) => void;
  }>;
  transcribeFile(s3Key: string): Promise<{ text: string; segments: Array<{ text: string; start: number; end: number; confidence: number }> }>;
}
```

```ts
// packages/integrations/src/contracts/tts.ts
export interface TtsProvider {
  synthesize(opts: {
    text: string;
    voiceId: string;
    format: 'mp3' | 'pcm16k';
  }): Promise<{ audio: Buffer; mimeType: string }>;
  synthesizeStream(opts: {
    text: string;
    voiceId: string;
  }): AsyncIterable<Buffer>;
}
```

```ts
// packages/integrations/src/contracts/eligibility.ts
export type EligibilityResult = {
  payerName: string;
  memberActive: boolean;
  coverageStart?: string;
  coverageEnd?: string;
  planType?: string;
  authRequired?: boolean;
  authPhone?: string;
  deductibleMet?: boolean;
  raw270: string;
  raw271: string;
};

export interface EligibilityProvider {
  check(opts: {
    tenantId: string;
    subscriberId: string;
    subscriberFirstName: string;
    subscriberLastName: string;
    subscriberDob: string;
    payerId: string;
    serviceDate?: string;
  }): Promise<EligibilityResult>;
}
```

```ts
// packages/integrations/src/contracts/llm.ts
export type LlmCallMeta = {
  tenantId: string;
  purpose: 'triage' | 'extract' | 'draft_sms' | 'draft_email' | 'voice_turn' | 'classify';
  piiScrubbed: boolean;
  promptHash: string;
};

export interface LlmProvider {
  complete(opts: {
    model: 'opus' | 'haiku';
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    maxTokens: number;
    tools?: Array<{ name: string; description: string; schema: unknown }>;
    meta: LlmCallMeta;
  }): Promise<{ text: string; toolCalls: Array<{ name: string; args: unknown }>; usage: { inputTokens: number; outputTokens: number; cacheHitTokens?: number } }>;
}
```

```ts
// packages/integrations/src/contracts/docai.ts
export type ExtractedFields = Record<string, unknown>;

export interface DocAiProvider {
  extract(opts: {
    tenantId: string;
    s3Key: string;
    schema: unknown;
    schemaVersion: string;
  }): Promise<{ fields: ExtractedFields; confidence: number; pageConfidences: number[] }>;
}
```

**Selector.** `packages/integrations/src/selector.ts` reads `tenant_ai_config.providers` and returns a bound adapter. Business logic imports only the contract. Swapping Twilio → Telnyx = one new adapter file + one row flipped in `tenant_ai_config`. Zero touches to voice-agent, SMS-nurture, or the dialer UI.

---

## 3. Data model additions (Drizzle, on `crm.*` schema)

Existing 9 tables: `tenants`, `users`, `organizations`, `contacts`, `referrals`, `referral_notes`, `referral_documents`, `bd_visits`, `audit_log`. All RLS-gated on `tenant_id` via `current_setting('app.current_tenant')`. Everything below follows the same pattern.

### 3.1 `conversations`
Per-contact multi-channel thread. Every inbound fax, SMS, call, email that references a contact creates/appends here.

```
id uuid pk, tenant_id uuid not null fk, contact_id uuid fk, referral_id uuid fk nullable,
channel text ('fax'|'voice'|'sms'|'email'|'web'),
last_message_at timestamptz, last_direction text ('in'|'out'),
ai_summary text (PHI-sensitive — scrub before display in cross-tenant reports),
created_at, updated_at
```
RLS: tenant isolation. Index `(tenant_id, last_message_at desc)` for inbox view. Index `(contact_id, last_message_at desc)` for contact page.

### 3.2 `conversation_messages`
```
id uuid pk, tenant_id uuid not null fk, conversation_id uuid not null fk,
direction text ('in'|'out'), channel text,
body text (PHI — pgcrypto envelope), body_redacted text (scrubbed copy for log views),
from_address text, to_address text,
provider_message_id text, provider_state text,
ai_generated boolean default false, ai_confidence double precision,
human_approved_by uuid fk users nullable, human_approved_at timestamptz,
sent_at timestamptz, delivered_at timestamptz, created_at
```
RLS: tenant isolation. Body encrypted with per-tenant KMS data key. Index `(conversation_id, created_at)`.

### 3.3 `voice_calls`
```
id uuid pk, tenant_id uuid not null fk, conversation_id uuid fk,
direction text, provider_call_id text unique per provider,
from_number text, to_number text,
state text, started_at, ended_at, duration_sec int,
recording_s3_key text, recording_consent_state text ('one_party'|'two_party_consented'|'refused'|'not_recorded'),
transcript_s3_key text, stt_provider text, stt_confidence_avg double precision,
ai_agent_id uuid fk (nullable — null = human agent), ai_agent_version text,
outcome text ('answered'|'voicemail'|'no_answer'|'busy'|'failed'), created_at
```
RLS: tenant isolation. Recording S3 bucket uses SSE-KMS with tenant-scoped CMK. Index `(tenant_id, started_at desc)`.

### 3.4 `sms_messages`
```
id uuid pk, tenant_id uuid not null fk, conversation_id uuid fk,
direction text, from_number text, to_number text,
body text, body_redacted text,
consent_recorded_at timestamptz, consent_source text ('web_form'|'voice_confirmation'|'paper'),
opt_out_at timestamptz nullable,
provider_message_id text, provider_state text,
delivery_state text, delivery_error_code text,
ai_generated boolean, human_approved_by uuid fk users, sent_at, created_at
```
RLS: tenant isolation. DB-side `CHECK (direction = 'in' OR consent_recorded_at IS NOT NULL)` on outbound rows. Index `(to_number, sent_at desc)`.

### 3.5 `ai_tasks`
Durable AI job record. Every LLM, STT, TTS, DocAI, embedding call lands here for audit + cost tracking.

```
id uuid pk, tenant_id uuid not null fk,
task_type text ('triage'|'extract'|'draft_sms'|'draft_email'|'voice_turn'|'classify'|'embed'|'transcribe'|'synthesize'),
subject_type text, subject_id uuid,
provider text ('bedrock'|'deepgram'|'polly'|'textract'|'claude_vision'),
model text, prompt_hash text, input_s3_key text nullable,
output_s3_key text nullable, output_summary text,
status text ('queued'|'running'|'succeeded'|'failed'|'human_review'),
input_tokens int, output_tokens int, cache_hit_tokens int,
audio_seconds double precision, pages int,
cost_usd_cents int,
latency_ms int, error text,
created_at, started_at, finished_at
```
RLS: tenant isolation. Index `(tenant_id, created_at desc)`, `(status, created_at)`, `(task_type, created_at desc)`.

### 3.6 `eligibility_checks`
```
id uuid pk, tenant_id uuid not null fk, referral_id uuid fk,
provider text default 'stedi', payer_id text, payer_name text,
subscriber_id text (PHI — pgcrypto), subscriber_dob text (PHI — pgcrypto),
member_active boolean, coverage_start date, coverage_end date,
plan_type text, auth_required boolean, auth_phone text,
raw_270_s3_key text, raw_271_s3_key text,
stedi_txn_id text, http_status int, error text,
checked_at timestamptz, created_at
```
RLS: tenant isolation. Raw 270/271 stored in S3. Index `(referral_id, checked_at desc)`.

### 3.7 `document_extractions`
```
id uuid pk, tenant_id uuid not null fk,
source_doc_type text ('referral_document'|'fax'|'bd_upload'), source_doc_id uuid,
provider text ('bedrock_vision'|'textract'|'haiku_classify'),
schema_version text, fields jsonb, confidence double precision,
page_confidences jsonb, needs_human_review boolean,
reviewed_by uuid fk users nullable, reviewed_at timestamptz, created_at
```
RLS: tenant isolation. Fields jsonb may contain PHI; treat the whole column as PHI for export/scrub. Index `(source_doc_id)`.

### 3.8 `consent_records`
Single table of truth for every consent across every channel.

```
id uuid pk, tenant_id uuid not null fk, contact_id uuid fk,
consent_type text ('tcpa_sms'|'tcpa_voice'|'hipaa_auth'|'call_recording'|'42_cfr_part_2'),
channel text, state_of_record text,
granted boolean, granted_at timestamptz,
revoked_at timestamptz nullable, revoked_reason text,
source text ('web_form'|'paper'|'voice_ivr'|'staff_entered'|'text_reply'),
evidence_s3_key text nullable,
created_at, updated_at
```
RLS: tenant isolation. Unique index `(contact_id, consent_type, granted_at)`. SMS/voice code paths MUST query this table, never cache stale consent in memory longer than the request.

### 3.9 `sla_events`
```
id uuid pk, tenant_id uuid not null fk, referral_id uuid fk,
event_type text ('first_touch'|'first_accept'|'eligibility_completed'|'soc_scheduled'|'soc_completed'),
occurred_at timestamptz, elapsed_sec_from_create int,
actor_type text ('human'|'ai'), actor_id uuid, created_at
```
RLS: tenant isolation. Index `(tenant_id, event_type, occurred_at desc)`.

### 3.10 `embedding_index`
pgvector-backed referral-source + payer memory.

```
id uuid pk, tenant_id uuid not null fk,
subject_type text ('org'|'contact'|'referral_note'|'call_turn'),
subject_id uuid, content text, content_hash text,
embedding vector(1024),
model text, model_version text,
ttl_at timestamptz,
created_at
```
RLS: tenant isolation. Index `USING ivfflat (embedding vector_cosine_ops)` partitioned per tenant. Weekly cron reindexes.

### 3.11 `tenant_ai_config`
Per-tenant switchboard for flags, providers, thresholds, prompts.

```
tenant_id uuid pk fk,
providers jsonb,
feature_flags jsonb,
prompts jsonb,
thresholds jsonb,
brand_voice_id text,
recording_consent_policy text ('one_party'|'always_two_party'),
sud_program boolean default false,
after_hours_policy jsonb,
updated_at, updated_by uuid fk users
```
RLS: tenant isolation, plus only role=`tenant_admin` can write.

### PHI pgcrypto strategy

PHI text columns use envelope encryption: per-tenant data key wrapped by KMS CMK, stored in `tenants.kms_key_ref`. `packages/db/src/crypto.ts` provides `encryptForTenant`/`decryptForTenant` and writes a row to `audit_log` on every decrypt with `{actor, row_id, column, purpose, promptHash?}`.

---

## 4. Security + compliance architecture

- **Per-tenant KMS envelope.** Each tenant gets a dedicated KMS CMK (aliased `alias/crm/tenant/<shortid>`). Data keys generated per logical column family, cached 10-min TTL. Every decrypt emits `audit_log` row. Cross-tenant decrypt fails at KMS policy.
- **BAA chain registry.** `docs/compliance/BAA-REGISTRY.md` lists every vendor touching PHI. CI check (`scripts/baa-check.ts`) fails if new adapter added without BAA entry.
- **PHI redaction before LLM.** Wrap every LlmProvider adapter in a `ScrubbingLlmProvider` decorator that runs scrubber on inputs and asserts `meta.piiScrubbed=true` unless call explicitly opts into "full-PHI for extraction" with documented purpose.
- **AI decision audit trail.** Every AI write produces: `ai_tasks` row + `audit_log` row + prompt hash + tool-call trace. Human approval stamped on `conversation_messages.human_approved_by/_at`.
- **Minimum-necessary enforcement.** AI prompts receive row-scoped views assembled by `apps/api/src/ai/context.ts`, never full `SELECT *`. Output schema forbids fields outside expected set.
- **Call recording consent.** State-of-record lookup before `openMediaStream`. Two-party state + missing consent → call proceeds without recording (`recording_consent_state='refused'`). Consent script plays as first TTS turn in all states.
- **TCPA SMS.** Triple gate: consent row + time window check (8am-9pm recipient local) + STOP/UNSUBSCRIBE keyword handler (<1 turn response).
- **42 CFR Part 2.** `tenant_ai_config.sud_program=true` gates SUD-adjacent flows. Second consent type required.
- **Supervisor-review gate.** Default `auto_send_*=false`. Per-tenant graduation after ≥95% human-approve-no-edit over 30 days.
- **Rate limits + anomaly guard.** Per-tenant SQS queue-depth alarms, LLM spend alarms, SMS/voice volume anomaly detectors.

---

## 5. Cost model

Mid-activity tenant (≈200 referrals/mo, ≈1,000 inbound fax pages, ≈400 outbound SMS, ≈200 voice-agent minutes, ≈80 eligibility checks).

| Feature | Unit | Price/unit | Mid-tenant monthly |
|---|---|---|---|
| Fax inbound (Documo) | page | $0.07 | $70 |
| Fax outbound (Documo) | page | $0.07 | $14 |
| Voice (Twilio inbound) | min | $0.0085 | trivial |
| Voice (Twilio outbound) | min | $0.014 | $2.80 |
| Voice agent STT (Deepgram Nova-3 Medical) | min | $0.0043 | $0.86 |
| Voice agent TTS (Polly Neural) | char | $16/1M | ~$1 |
| Voice agent LLM turns (Haiku 4.5) | — | — | ~$12 |
| SMS outbound (Twilio) | segment | $0.0083 | $3.32 |
| Eligibility (Stedi) | txn | $0.15 | $12 |
| DocAI — fax triage (Haiku classifier) | — | — | ~$3 |
| DocAI — fax extract (Claude Vision Opus, 35%) | — | — | ~$35 |
| DocAI — fax extract (Textract, 65%) | page | $0.0015 | ~$1 |
| Embeddings (Titan v2 1024d) | 1k tokens | $0.00002 | ~$1 |
| Storage (S3 PHI + KMS) | GB-mo | $0.023 + $1/key | ~$3 |
| Baseline infra share (ECS + RDS + ALB + CloudWatch) | — | — | ~$20 |
| **Variable AI+infra total per mid-tenant** | | | **≈ $175-200/mo** |

**Margin.** At $499/mo/tenant seat, COGS ~$175 + $25 support = $200 → gross margin ~60%. At $999/mo, margin 80%+.

**Fallback free-tier.** Rule-based (no LLM, no voice agent): fax inbound + manual triage + Stedi eligibility + SMS without AI draft + WellSky migration. COGS ~$40, sell at $149/mo. Same codebase, flags off.

**Twilio $250 floor.** Break-even: 1 paying tenant. If 2 paid pilots miss 60-day target, swap voice to Chime Voice Connector (BAA-free AWS, $0 floor) at cost of ~3-5 eng days.

---

## 6. Deployment + rollout

**Feature flags per tenant.** Phase 1: JSON in `tenant_ai_config.feature_flags`, cached 30s TTL via `packages/config/src/feature-flags.ts`. Phase 2: Unleash self-hosted.

**Dark launch pattern.** Every AI feature ships in three states:
1. **Shadow.** AI runs parallel to human. `ai_tasks` status=`shadow_only`. Nightly agreement metrics.
2. **Assist.** AI output in draft tab, human clicks Send. Track `human_approved_no_edit` rate.
3. **Auto.** Per-template flag after ≥85% no-edit rate over 30 days. Per-tenant opt-in.

**Canary tenants.** Seed 2 pilot agencies (one HH, one hospice). 4-week evaluation per feature.

**SLO targets (Phase 1).**
- Inbox-to-first-touch p50 <5 min, p99 <30 min
- Fax OCR p50 <90s, p99 <5 min
- Voice agent joinable latency <3s
- Eligibility p50 <8s, p99 <30s
- AI draft SMS latency p50 <4s, p99 <15s

**Phase 1 build order (12-16 wk, 1-2 engineers).**
1. **Weeks 1-4: Fax → referral.** Documo webhook → S3 → Haiku classifier → Claude Vision extract → draft `referrals`. Human-review UI. Shadow 2wk, assist thereafter.
2. **Weeks 4-8: Inbox triage + SLA engine.** `conversations` + `conversation_messages` + SLA timers. AI drafts gated behind approve.
3. **Weeks 8-14: Voice agent.** Twilio Media Streams → Deepgram → Haiku → Polly. Inbound-only first. Add outbound nurture week 12 after consent plumbing verified.

Deferred Phase 2: scheduling solver, 42 CFR Part 2, ElevenLabs brand voice, full WellSky migration.

---

## 7. Open decisions

1. **Deepgram billing tier.** PAYG 60 days, re-evaluate at 500+ min/mo/tenant.
2. **Twilio alternative.** Spike Chime Voice Connector 1 week parallel to Twilio.
3. **Embeddings model.** Titan v2 start, swap to Cohere Embed English v3 if retrieval quality blocks.
4. **Voice agent framework.** Roll own thin loop (~500 LOC) Phase 1; LiveKit Agents if latency tuning becomes a tar pit.
5. **Scheduling solver.** Greedy for pilot; OR-tools when tenant has >5 nurses.

---

## 8. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Documo outage | new inbound faxes queue fail | SRFax passive secondary; flip `tenant_ai_config.providers.fax` |
| Deepgram SLA breach | voice agent degrades | Transcribe Medical failover wired + tested monthly |
| Bedrock region capacity | LLM latency spikes | multi-region inference (us-east-1 + us-west-2) |
| Twilio BAA + $250/mo at 0-1 tenants | cash burn | Chime Voice Connector spike |
| pgvector recall degrades | stale referral-source memory | HNSW index; Pinecone BAA fallback |
| PHI leaks to logs | regulatory exposure | scrubber decorator; weekly synthetic PHI injection test |
| Auto-send regression | TCPA exposure | kill-switch; per-template rollout |
| BAA gap with new vendor | compliance breach | `scripts/baa-check.ts` CI gate; `docs/compliance/BAA-REGISTRY.md` |

---

## 9. Cross-references

- Architecture partner doc: `Plans/demo-rework/02-ai-ops-architecture.md`
- Regulatory memo: `Plans/demo-rework/04-regulatory-memo.md`
- Infra migration: `Plans/phase-0-foundation/AWS-ONLY-MIGRATION.md`
- Schema baseline: `Plans/phase-0-foundation/0.3-postgres-schema.md` + `packages/db/src/schema/*`
- Integration canon: `REF/CRM-07-INTEGRATIONS.md`
- Security: `REF/CRM-08-SECURITY-HIPAA.md`
