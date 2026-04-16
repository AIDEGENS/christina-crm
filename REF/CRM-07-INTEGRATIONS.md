# CRM-07 — Integrations

> CRM-specific integration points. For the full API inventory (Stedi, NPPES, Bedrock, etc.), see `Insurance Claims/REF/API-INVENTORY.md`. This doc covers what the CRM layer specifically needs.

## Tier 1 — Required for v1 launch

### 1. eFax / SRFax → SES inbound
- **What:** Receive faxes as email attachments
- **How:** Client's eFax provider (SRFax, Updox, Concord, RingCentral Fax) configured to forward all inbound faxes to a dedicated SES address per tenant
- **SES config:** Inbound rule → store attachment in S3, trigger SNS → Inngest
- **BAA:** SES is covered under AWS BAA
- **[CONFIRM]** What eFax provider does the client currently use?

### 2. Stedi — 270/271 eligibility
- **What:** Real-time Medicare/Medi-Cal eligibility verification
- **Trigger:** Auto on referral intake; manual re-check button
- **Auth:** API key per environment
- **BAA:** Yes (paid plan)
- **Already scoped in:** `API-INVENTORY.md`

### 3. AWS Bedrock — Claude Sonnet 4.6
- **What:** Extract structured data from fax/email PDFs
- **Trigger:** Inngest `referral.parse` step
- **Prompt:** System prompt with field schema + few-shot examples of HH/hospice referral packets
- **BAA:** Yes (covered by AWS BAA)
- **Cost:** ~$0.01-0.05 per referral extraction (3-page PDF → ~2k input tokens + 500 output tokens)

### 4. Claims platform scrubber API
- **What:** Denial risk score for new referrals
- **Trigger:** Auto after eligibility check
- **How:** Internal API call within VPC (no external exposure)
- **Auth:** Internal service-to-service (IAM role or shared secret)

### 5. NPPES NPI Registry
- **What:** Auto-lookup provider/org NPI on contact/org creation
- **How:** Public REST API, no auth, rate-limited
- **Cache:** Aggressive caching (NPIs don't change often)

### 6. WorkOS
- **What:** Auth, SSO, MFA, roles, audit log, directory sync
- **Already scoped:** BAA signed, per `BAA-CHECKLIST.md`

## Tier 2 — Should have for v1

### 7. SES outbound — email notifications
- **What:** Referral assigned, SLA breach, eligibility failed alerts
- **BAA:** Covered under AWS BAA
- **Rule:** Email body contains referral ID + link only, NOT PHI. User must log in to see details.

### 8. Twilio — SMS notifications **[CONFIRM]**
- **What:** Push-style notifications to BD reps in the field
- **BAA:** Yes (available on paid plans)
- **Rule:** SMS body = "New referral from Mercy General. Login to review." — NO PHI in SMS text.
- **[CONFIRM]** Does client want SMS notifications, or is email sufficient?

## Tier 3 — Could have / deferred

### 9. GHL (GoHighLevel) **[CONFIRM]**
- **What:** If the client uses GHL for marketing/lead nurture
- **Direction:** One-way push from CRM → GHL (new org contact → GHL contact for nurture)
- **PHI risk:** GHL has NO BAA. Only non-PHI data (org name, contact name, phone) can flow to GHL. Never patient data.
- **[CONFIRM]** Is GHL in the picture for this client? If yes, we need a strict data boundary.

### 10. QuickBooks / accounting
- **What:** If client wants invoice/payment tracking
- **PHI risk:** QB has BAA on enterprise tier, but scope is limited
- **Defer:** Not needed in v1. The CRM doesn't handle billing; the claims platform does.

### 11. Google Calendar / Outlook
- **What:** SOC scheduling sync
- **PHI risk:** Calendar entries must use initials/MRN only, never patient names
- **Defer:** V2 feature

### 12. WellSky CSV/SFTP import
- **What:** Import existing patient/referral/org data from WellSky for migration
- **How:** Client exports CSV from WellSky; we ingest via S3 upload + Inngest ETL pipeline
- **PHI:** Full PHI in the export → stored encrypted in S3, parsed into CRM schema
- **See:** `CRM-09-MIGRATION-FROM-WELLSKY.md`

## Integration architecture

```
                    ┌─── External (BAA-signed) ───┐
                    │ Stedi (eligibility)          │
                    │ WorkOS (auth)                │
                    │ SES (email in/out)           │
                    │ Bedrock (AI extraction)      │
                    │ NPPES (NPI lookup)           │
                    │ Twilio (SMS — if confirmed)  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │      CRM API (Hono/Fastify)  │
                    │      on ECS Fargate (VPC)    │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────┴────────┐  ┌───────┴───────┐  ┌─────────┴────────┐
    │ RDS Postgres     │  │ S3 (docs)     │  │ Claims scrubber  │
    │ crm.* schema     │  │ KMS-encrypted │  │ (internal API)   │
    └──────────────────┘  └───────────────┘  └──────────────────┘
```

## Data flow rules (PHI boundaries)

| Source | Destination | PHI allowed? | Rule |
|---|---|---|---|
| SES → S3 | Yes | Raw fax PDFs contain PHI; encrypted at rest |
| S3 → Bedrock | Yes | PDF sent to Claude for extraction; Bedrock under AWS BAA |
| CRM API → Stedi | Yes | Patient payer info for 270/271; Stedi has BAA |
| CRM API → SES outbound | **Minimal** | Notification emails contain link only, not PHI |
| CRM API → Twilio | **NO** | SMS text = generic alert; no patient info |
| CRM → GHL | **NO** | Organization/contact data only; never patient data |
| CRM → Datadog | **Scrubbed** | Logs pass through PHI scrubber before shipping |
| CRM → Stripe | **NO** | Customer ID only; no names, no patient data |
