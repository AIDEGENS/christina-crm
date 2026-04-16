# CRM-06 — Referral Flow

> Step-by-step flow from referral ingestion to admission. This is the core workflow the CRM enables.

## Channel → intake → pipeline → admission

```
 INBOUND CHANNELS                    INTAKE ENGINE                         PIPELINE
 ─────────────────                   ──────────────                        ────────

 [Fax from hospital]  ──→ SES ──→ S3 (raw PDF) ──→ Inngest: parse-fax
 [Email from physician] ──→ SES ──→ S3 (raw PDF)        │
 [e-Referral portal]   ──────────→ API endpoint          │
 [Phone/walk-in]       ──────────→ Manual entry UI        │
                                                          ↓
                                                   Bedrock Sonnet 4.6
                                                   extract structured fields
                                                          │
                                                   ┌──────┴──────┐
                                                   │ confidence   │
                                                   │  ≥ 0.8?     │
                                                   └──────┬──────┘
                                                    yes │    │ no
                                                        ↓    ↓
                                               [AUTO-ACCEPT] [NEEDS REVIEW]
                                                        │         │
                                                        ↓         ↓
                                                   ┌──────────────────┐
                                                   │ crm.referrals    │
                                                   │ status = NEW     │
                                                   └────────┬─────────┘
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ↓                           ↓
                                    Stedi 270/271                 Scrubber API
                                    eligibility check             denial risk score
                                              │                           │
                                              ↓                           ↓
                                    ┌─────────────────┐         ┌────────────────┐
                                    │ ELIGIBILITY     │         │ Risk score     │
                                    │ verified/failed │         │ stored on ref  │
                                    └────────┬────────┘         └────────────────┘
                                             │
                                    ┌────────┴────────┐
                                    │ verified?       │
                                    └────────┬────────┘
                                     yes │       │ no
                                         ↓       ↓
                              [SOC SCHEDULING] [MANUAL REVIEW]
                                         │
                                         ↓
                              Intake coordinator assigns nurse
                              Sets SOC date/time
                                         │
                                         ↓
                              ┌──────────────────┐
                              │ SOC SCHEDULED    │
                              └────────┬─────────┘
                                       │
                              Nurse completes SOC visit
                                       │
                                       ↓
                              ┌──────────────────┐
                              │ ADMITTED         │
                              └────────┬─────────┘
                                       │
                              Creates claims.episode
                              (handoff to scrubber)
```

## Step-by-step detail

### Step 1: Fax/email arrives
- **Trigger:** SES receives email from eFax provider (or direct physician email)
- **Action:** Inngest `fax.received` event fires
- **Storage:** Raw PDF → S3 `/{tenant_id}/fax-inbox/{uuid}.pdf` (KMS-encrypted)
- **Audit:** `intake_document_received` logged

### Step 2: AI extraction
- **Trigger:** Inngest `fax.received` → `referral.parse` step
- **Action:** Claude Sonnet 4.6 via Bedrock reads the PDF
- **Prompt:** Structured extraction prompt requesting: patient name (initials only for display), DOB, sex, age, dx codes, payer info, orders, discharge date/time, referring physician, source org
- **Output:** JSON with confidence score per field + overall confidence
- **PHI handling:** Full name stored encrypted; initials used for display
- **Audit:** `ai_extraction_completed` with confidence score

### Step 3: Eligibility check (auto)
- **Trigger:** Inngest `referral.parsed` → `referral.check-eligibility` step
- **Action:** Stedi 270/271 transaction with patient payer info
- **Result:** Verified / Failed / Pending (some payers respond async)
- **If failed:** Referral card shows red "FAILED" badge; user must investigate
- **Audit:** `eligibility_checked` with Stedi transaction ID

### Step 4: Denial risk scoring (auto, optional)
- **Trigger:** Inngest `referral.eligibility-done` → `referral.score-risk` step
- **Action:** Calls claims platform scrubber API with referral data
- **Result:** 0-100 denial risk score
- **If high risk (>60):** Orange warning badge on referral card
- **Audit:** `denial_risk_scored`

### Step 5: Intake review
- **Actor:** Intake coordinator (Sarah L.)
- **Action:** Reviews the parsed referral card in inbox
  - If AI parsed correctly → one-click "Accept" → moves to pipeline
  - If fields need correction → edit form → save → accept
  - If missing physician signature → flag as "Needs review" → contact source org
- **Audit:** `referral_reviewed` with changes diff

### Step 6: SOC scheduling
- **Actor:** Intake coordinator or scheduler
- **Action:** Assign SOC nurse, set SOC date/time
- **Constraint:** SOC must occur within CMS timely-filing window (varies by payer)
- **Status change:** New → SOC Scheduled
- **Notification:** SOC nurse receives email/push with patient details
- **Audit:** `referral_soc_scheduled`

### Step 7: SOC visit completed
- **Actor:** SOC nurse (in field)
- **Action:** Marks SOC completed in CRM (or via WellSky during dual-run)
- **Status change:** SOC Scheduled → Admitted
- **CRM action:** Creates `claims.episode` record (handoff to scrubber platform)
- **Audit:** `referral_admitted`

### Step 8: Lost/Denied
- At any point, a referral can be moved to Lost/Denied
- Must record reason: eligibility failed, patient declined, competitor won, capacity, insurance issue
- Lost-reason data feeds reports (CRM-05 S2)
- **Audit:** `referral_lost` with reason

## Timing SLAs

| Metric | Target | Alert |
|---|---|---|
| Fax → parsed | < 30 seconds | Red if > 5 minutes |
| Parsed → eligibility result | < 60 seconds | Red if > 10 minutes |
| New → intake reviewed | < 4 hours | Yellow at 2h, red at 4h |
| Reviewed → SOC scheduled | < 24 hours | Yellow at 12h, red at 24h |
| Referral → SOC visit | < 48 hours | Dashboard KPI |

## Error handling

- **Bedrock timeout/failure:** Retry 3x with exponential backoff; if still fails, mark referral as "MANUAL PARSE" and alert intake coordinator
- **Stedi timeout/failure:** Retry 2x; mark eligibility as "PENDING" and recheck on cron every 15 minutes
- **S3 upload failure:** Inngest retries; if persistent, alert ops via Datadog
- **Invalid PDF (scan quality):** Claude returns low confidence; route to manual review
