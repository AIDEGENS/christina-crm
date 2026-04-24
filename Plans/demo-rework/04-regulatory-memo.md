# 04 — Regulatory Risk Memo: AI-Ops for HH/Hospice CRM

**Status:** Draft for engineering planning
**Date:** 2026-04-23
**Scope:** Christina CRM AI-enabled outbound communications, inbound attendant, fax OCR, clinical-doc drafting, ambient BD capture
**Pilot states:** California, Nevada
**Tenants:** Home-health and hospice agencies (Medicare Part A providers)

> **NOT LEGAL ADVICE.** This memo is engineering guidance written for product and infrastructure decisions. It summarizes statutory posture based on public regulations available as of 2026-04-23. Any pre-launch regulatory sign-off must come from licensed outside counsel, especially before the first live AI-initiated outbound communication to a patient, caregiver, or referring clinician. Several items below are flagged `verify with counsel` where rule status is unsettled.

---

## TL;DR — Caveman Summary

> Cave rule: if fire burn tribe, fire bad. Build cave wall before fire.

- **BIG DANGER FIVE** (things tribe sue for, make lawsuit rain):
  1. **ROBO-CALL NO-ASK.** AI voice dial patient without paper "yes" = TCPA. Phone company god angry. $500-$1500 per call. Class rock-slide.
  2. **AI-VOICE-NO-SAY-AI.** AI talk on phone, not say "me robot" at start = FCC 24-28 break. Fine. Shut down.
  3. **NO-BAA-VENDOR.** PHI go to LLM vendor with no paper-seal = HIPAA 164.504(e). OCR bear come eat agency.
  4. **CALIFORNIA TWO-EAR TAPE.** Record call in CA without both grunt "yes" = CIPA §632. Grog lose $5000 per call.
  5. **DOC-SIGN-NO-NURSE.** AI fill Medicare 485/POC, no nurse-eye check = False Claim fire. Federal spear.

- **MOCKUP MUST SHOW THREE THINGS** (show hunter-chief "we safe"):
  1. Consent badge on every AI button — cannot press unless green.
  2. State-aware recording script pre-filled on outbound call screen.
  3. "Supervised Mode" default — AI draft, human bone-stamp before send.

- **NEVER BUILD THIS ONE** (most cursed feature):
  - AI pretend to be Dr. Smith on phone. Voice-clone patient's doctor. Fraud cave. Board of medicine throw Grog out of hut forever.

- **CALL OUTSIDE SHAMAN WHEN:**
  - First paid pilot contract comes in. Before send first live AI message. Before mail recording. If breach. If class-action letter. Stop DIY. Pay lawyer. Cheaper than cave burn down.

---

## 1. TCPA — SMS + Voice to Patient, Caregiver, Referral Source

**Statute:** Telephone Consumer Protection Act, 47 U.S.C. § 227; implementing rules at 47 C.F.R. § 64.1200.

### 1.1 Consent tiers by call purpose

TCPA treats automated calls (including AI voice and bulk SMS) differently based on content:

| Call purpose | Consent required | Practical example |
|---|---|---|
| **Emergency** | None | Outbreak alert, recall |
| **Informational / transactional** (healthcare-related) | Prior express consent | Appointment reminder, visit confirmation |
| **Marketing** (incl. mixed-purpose) | Prior express **written** consent (signature) | "Would you like more services?", cross-sell |

Healthcare-related calls to a number the patient provided during care have a narrower "HIPAA safe harbor" reading (FCC 2012 declaratory ruling, reaffirmed 2015): prior express consent is deemed given if the number was supplied in connection with care, and the call concerns healthcare as defined in 45 CFR 160.103. This is a **narrow** safe harbor — it does not reach marketing, does not reach referral-source calls, and does not reach caregivers who did not themselves provide the number.

### 1.2 FCC 24-28 — AI-voice disclosure rule (effective 2024-07)

The FCC's February 2024 Declaratory Ruling (CG Docket 02-278, release FCC 24-28) confirmed that calls using **AI-generated voices** are "artificial or prerecorded voice" messages under § 227(b)(1)(A), which means:

- Prior express **written** consent is required for any non-emergency AI-voice call to a residential or wireless line — whether the content is marketing or not (the long-standing "informational-call" exemption for residential lines does not cover AI voice).
- The call must identify the entity responsible at the start and provide a call-back number.
- Industry practice as of 2025 is to open AI-voice calls with an audible disclosure ("This is an automated assistant calling on behalf of [Agency]") to reduce deception-based state-AG risk even where federal rule is silent on the exact wording.

> **Verify with counsel:** The FCC "one-to-one consent" rule (FCC 23-107, scheduled 2025-01-27) was vacated by the 11th Circuit in *Insurance Marketing Coalition v. FCC* (January 2025). Pre-vacatur consent flows are again acceptable under federal law, but several state mini-TCPA statutes (FL, OK, WA) independently adopted one-to-one-like requirements. Treat one-to-one as de facto best practice.

### 1.3 Revocation

47 C.F.R. § 64.1200(a)(10) (as amended by the 2024 Revocation Order): consumers may revoke consent through "any reasonable means." The caller must:

- Honor revocation within **10 business days**.
- Accept revocation via reply-STOP (SMS), pressing a keypad option (voice), emailing any address the caller uses for business, or orally during a live call.
- Apply revocation across all messaging categories in the same "subject matter" unless the consumer specifies otherwise.

### 1.4 Calling hours

Federal: 8:00 am – 9:00 pm at the **recipient's** local time (§ 64.1200(c)(1)). State overlays:

- **California:** CBPC § 17592(c) — same federal window, but the state enforces it independently as an unfair business practice (private right of action under UCL).
- **Florida Mini-TCPA** (Fla. Stat. § 501.059, as amended 2023): 8:00 am – 8:00 pm, max 3 calls on same subject in 24 hours.
- **Oklahoma Telephone Solicitation Act** (Okla. Stat. tit. 15 § 775C): 8:00 am – 8:00 pm.

### 1.5 Damages

- Negligent violation: **$500 per call / per text** (§ 227(b)(3)).
- Willful or knowing: **up to $1,500 per call / per text**.
- Private right of action, class-action friendly. A single ill-scoped SMS blast can produce seven-figure exposure with a single plaintiff's firm.

---

## 2. HIPAA — BAA Chain for AI and Voice Providers

**Statute:** HIPAA Privacy, Security, and Breach Notification Rules at 45 C.F.R. Parts 160 and 164.

### 2.1 BAAs are mandatory, end-to-end

Under 45 C.F.R. § 164.504(e), every vendor that "creates, receives, maintains, or transmits" PHI on behalf of a covered entity or business associate must sign a BAA. For the Christina AI-ops stack, this includes:

- LLM providers (Anthropic, OpenAI, AWS Bedrock) — BAAs available; must be executed before any live PHI touches the model.
- Voice providers (Twilio, Telnyx, Vonage, Deepgram, AssemblyAI, etc.) — each vendor in the audio path needs its own BAA.
- Fax OCR / document intelligence (AWS Textract, Google Document AI) — BAAs available on covered tiers only.
- Embedding stores, vector DBs (Pinecone, Qdrant, pgvector on RDS) — if vectors are derived from PHI they are PHI.
- Analytics, error monitoring, session replay — Sentry, Datadog, PostHog, FullStory all require BAAs or PHI-redaction before ingest.

Sub-processors also need flow-down BAAs per § 164.308(b)(2).

### 2.2 Minimum-necessary rule applied to AI prompts

45 C.F.R. § 164.502(b) limits disclosure of PHI to the minimum necessary. Applied to LLM usage:

- Redact or tokenize identifiers in prompts when the model does not need them to answer (names, DOBs, MRNs, addresses, phone numbers).
- Prefer structured fields + pseudonymous IDs over raw transcript pasting.
- Treat every prompt as a disclosure event: log who, what, when, which model.

### 2.3 Audit controls on AI decisions

45 C.F.R. § 164.312(b) requires "hardware, software, and procedural mechanisms that record and examine activity." For AI features:

- Persist every AI-generated artifact (draft message, suggested label, summarized note) with input hash, model + version, prompt template ID, and operator identity.
- Retain audit records for 6 years minimum (§ 164.316(b)(2)(i)).
- Surface AI decisions in the tenant-facing audit log so CMS / OCR investigators can reconstruct the chain.

### 2.4 Breach-notification clocks

- **HHS / OCR:** within 60 days of discovery for the affected individuals (45 C.F.R. § 164.404); 60 days for HHS for breaches ≥ 500 individuals; annual log for < 500 (§ 164.408).
- **State overlays** (non-exhaustive):
  - California (CMIA / Civil Code § 1798.82): without unreasonable delay; **healthcare-specific 15-business-day** notice under Health & Safety Code § 1280.15 for California-licensed clinics/facilities.
  - Florida (Fla. Stat. § 501.171): 30 days.
  - Texas (Tex. Bus. & Com. Code § 521.053): 60 days.
  - Colorado (C.R.S. § 6-1-716): 30 days.

Build breach workflow around the **shortest** applicable clock per tenant state.

### 2.5 Risk analysis and risk management

45 C.F.R. § 164.308(a)(1)(ii)(A)–(B) require periodic risk analysis and active risk management. AI is a new asset class; each AI feature shipped should be added to the risk register with:

- Data-flow diagram
- Threat model (prompt injection, model exfil, output leakage, hallucinated PHI)
- Mitigations
- Residual-risk sign-off

### 2.6 2024 Change Healthcare lessons

The February 2024 Change Healthcare ransomware incident (Optum / UHG) demonstrated:

- Single-point-of-failure clearinghouses can halt revenue for months.
- Cyber-liability insurance is effectively mandatory for any HH/hospice tenant post-2024.
- A written, rehearsed incident-response plan (IRP) is now a baseline vendor-diligence checklist item.
- OCR is likely to continue ramping HIPAA enforcement; 2025 penalties already exceed 2023 totals.

---

## 3. State Call-Recording Consent Laws

Federal baseline: 18 U.S.C. § 2511 — one-party consent. Majority of states match. **Twelve** states require all-party consent; several more have ambiguous case law that makes all-party the safe default.

### 3.1 Top-15 HH-population-weighted table

| State | Rule | Notable statute / case |
|---|---|---|
| California | **All-party** | Penal Code § 632 (CIPA); § 632.7 for cellular |
| Texas | One-party | Tex. Penal Code § 16.02 |
| Florida | **All-party** | Fla. Stat. § 934.03 |
| New York | One-party | N.Y. Penal Law § 250.00 |
| Pennsylvania | **All-party** | 18 Pa. Cons. Stat. § 5704 |
| Illinois | **All-party** | 720 ILCS 5/14-2 (revised post-*Clark* 2014) |
| Ohio | One-party | Ohio Rev. Code § 2933.52 |
| Michigan | Ambiguous (safe: all-party) | MCL § 750.539c |
| North Carolina | One-party | N.C.G.S. § 15A-287 |
| Georgia | One-party (device-user) | O.C.G.A. § 16-11-62 |
| Arizona | One-party | A.R.S. § 13-3005 |
| Nevada | **All-party (in-person) / one-party (phone)** by *Lane v. Allstate* reading | NRS § 200.650 |
| Washington | **All-party** | RCW § 9.73.030 |
| Massachusetts | **All-party** (strictest — written/verbal consent, no beep allowed as sole disclosure) | M.G.L. ch. 272 § 99 |
| Missouri | One-party, **but** § 542.402 criminalizes unauthorized intercept | Mo. Rev. Stat. § 542.402 |

### 3.2 Recording-consent script language

A compliant opening line that also satisfies FCC 24-28 AI-voice identification:

> "Hello, this is an automated assistant calling on behalf of [Agency Name]. This call may be recorded for quality and compliance. If you do not wish to be recorded, please say 'stop' or press 9 now. Otherwise, continuing the call confirms your consent."

For **Massachusetts**, do not rely on implied consent — require an affirmative "yes" before proceeding or drop the call.

### 3.3 California-specific traps

- CIPA § 632 private right of action: **$5,000 per violation** or three times actual damages, whichever is greater.
- CIPA § 632.7 covers **cellular intercepts** and has been the basis for most 2022-2025 class actions against website chat and session-replay vendors (*Javier v. Assurance IQ*; *Byars v. Hot Topic*; *Valenzuela v. Super Hero Kids*). Applies to voice recording too.
- Do not assume a "Nevada one-party" recording is lawful when the Nevada caller dials a California recipient — California law governs the California end.

### 3.4 Missouri, Pennsylvania, Illinois traps

- **Pennsylvania:** All-party applies to *any* oral communication where a party has a reasonable expectation of privacy, even in person. Ambient BD-rep capture requires explicit pre-recording consent from every party at the table.
- **Illinois:** Post-*People v. Clark* (2014) rewrite clarified that recording a "private conversation" without consent is a Class 3 felony on repeat offenses.
- **Missouri:** One-party for telephone, but surreptitious in-person recording can implicate § 542.402 intercept statute.

---

## 4. 42 CFR Part 2 — Substance Use Disorder Records

**Statute:** 42 U.S.C. § 290dd-2; regulations at 42 C.F.R. Part 2.

### 4.1 When it triggers

A HH or hospice patient's record is Part 2-protected only if the record **identifies the patient as having or having had a substance use disorder** AND the record was created by a federally-assisted SUD program, OR references treatment received at such a program. Routine HH/hospice care notes generally are not Part 2, but:

- Referrals from methadone / MAT clinics
- Discharge summaries from inpatient SUD rehab that accompany a hospice intake
- Naloxone-rescue event notes during skilled-nursing visits

can all bring a record under Part 2.

### 4.2 2024 final rule (HHS, effective 2024-04-16, compliance 2026-02-16)

The 2024 final rule aligns Part 2 with HIPAA in several important ways:

- **Single patient consent** for all future TPO (treatment, payment, operations) uses, rather than per-disclosure consents.
- Breach notification now aligned with HIPAA 60-day clock.
- Civil and criminal penalties from HIPAA now apply to Part 2 violations (up to $1.9M per violation tier per year).
- Patients retain the right to a separate accounting of disclosures for Part 2 data.

### 4.3 Practical CRM impact

- Tenant-level **SUD-aware flag** on the patient record.
- PHI scrubber must recognize SUD-indicative terms (MAT drug names, clinic names, ICD-10 F10-F19) and either redact or route to a Part 2-segregated pipeline before LLM processing.
- Audit log must separately record Part 2 disclosures.
- Outbound AI messaging must never disclose SUD status to a third party (including caregivers) without the Part 2-compliant consent on file.

---

## 5. CMS + State Licensing Overlays

### 5.1 Medicare Conditions of Participation

- **Home Health CoPs** (42 C.F.R. Part 484):
  - § 484.50 — patient rights: notice, informed consent, complaint handling.
  - § 484.60 — care planning: the plan of care (POC / 485) must be established and reviewed by a physician or allowed practitioner; the HHA must follow physician orders.
  - § 484.105 — QAPI.
- **Hospice CoPs** (42 C.F.R. Part 418):
  - § 418.52 — patient rights.
  - § 418.56 — interdisciplinary group; plan of care must be reviewed every 15 days.
  - § 418.22 — certification of terminal illness.

### 5.2 State licensing authorities

- **California:** CDPH Licensing & Certification — Home Health Agency and Hospice licensure under Health & Safety Code §§ 1725 et seq. Separate CDPH complaint portal and consumer right to file HIPAA-equivalent claims.
- **Nevada:** Division of Public and Behavioral Health (DPBH) — NAC Chapter 449; hospice licensed separately.
- **Texas:** HHSC Home & Community Support Services Agency license; separate branch/parent agency rules.

### 5.3 Anti-Kickback Statute (AKS) and Stark

- **AKS** (42 U.S.C. § 1320a-7b(b)): criminalizes knowingly offering or paying remuneration to induce referrals of federal-program business. **AI-personalized gifts, meals, or marketing to referral-source physicians** are high-risk. Maintain a documented safe-harbor posture (e.g., bona fide employment, personal services agreement).
- **Stark / Physician Self-Referral** (42 U.S.C. § 1395nn): prohibits physician referrals to DHS entities (HH counts; hospice is *not* DHS) where there is a financial relationship without a safe harbor. Less applicable to hospice but still live for HH tenants.
- AI-sent SMS campaigns that offer *anything of value* to referring clinicians (gift cards, conference invites, meals) should be flagged and routed through compliance review.

### 5.4 No Surprises Act

The federal NSA (45 C.F.R. § 149) applies principally to facility-based and emergency services. Part A HH/hospice services are largely outside the core billing-protection provisions, but the **Good Faith Estimate** component (for uninsured/self-pay patients) is a rising transparency expectation. Build pricing-disclosure templates for future tenants who elect self-pay services.

---

## 6. Consent Architecture Requirements for the CRM

### 6.1 Per-contact consent record (minimum schema)

```sql
consent_records (
  contact_id          uuid,
  channel             enum('sms','voice','ai_voice','email','fax','recording'),
  purpose             enum('informational','marketing','transactional','recording'),
  granted_at          timestamptz,
  source              text,       -- 'intake-form-v3', 'verbal-recording', 'ghl-import'
  source_evidence_ref text,       -- S3 key to signed doc / recording / screenshot
  expires_at          timestamptz, -- nullable
  revoked_at          timestamptz, -- nullable
  revoked_via         text,       -- 'sms-stop', 'phone-oral', 'email', 'portal'
  tenant_id           uuid,
  updated_at          timestamptz
);
```

Every outbound AI send must perform a consent lookup and hard-fail on missing / revoked records.

### 6.2 Opt-in templates

- **TCPA opt-in (written, for marketing):** must clearly disclose (a) the seller, (b) that consent is not a condition of purchase, (c) that auto-dialer / AI voice / prerecorded messages may be used, (d) the phone numbers to which consent applies. E-SIGN-compatible electronic signature acceptable.
- **HIPAA safe-harbor intake phrasing (for healthcare-related calls):** "By providing your phone number, you agree to receive care-related calls and texts from [Agency], which may include automated and AI-assisted messages." Not sufficient for marketing.

### 6.3 HIPAA marketing authorization

If any AI-sent message is "marketing" under 45 C.F.R. § 164.501 (encouraging use of a product or service), you need a signed HIPAA authorization per § 164.508 that specifies:

- Description of PHI to be used
- Persons authorized to use
- Persons authorized to receive
- Purpose
- Expiration
- Right to revoke
- Re-disclosure statement

### 6.4 Recording consent script — tenant-configurable per state

Single canonical template, state selector driven by caller area code + recipient area code + recipient state-of-record, with an "all-party fallback" toggle that forces all-party script on any ambiguous match.

### 6.5 Part 2 extra-consent flag

Boolean on contact + workflow gate: if true, AI outbound blocked unless Part 2-compliant consent is on file and the LLM pipeline is the Part 2-segregated variant.

### 6.6 Audit trail

- Exportable CSV + JSON per tenant.
- Filterable by contact, date range, channel, operator, AI-involved-yes/no.
- Includes every AI draft, whether sent, who sent, and any human edit diff.

---

## 7. Red Flags — Features That Should NOT Ship

1. **Patient-impersonation AI voice.** Cloning or mimicking a specific clinician's voice ("Hi, this is Dr. Smith's office") without the clinician's on-the-record consent implicates fraud, state medical-board unprofessional-conduct rules, FTC § 5 unfair/deceptive practices, and — in CA — Civil Code § 3344 right-of-publicity. Do not build.
2. **Inferred-consent auto-dial.** Dialing any number not tied to an explicit consent record. This is a guaranteed TCPA loss; no "CRM said it was okay" defense exists.
3. **AI-finalized clinical documents without nurse review.** Medicare-certified POC/485 forms, hospice certifications of terminal illness, and OASIS submissions require a licensed clinician's signature. An AI that submits or auto-signs these is a False Claims Act (31 U.S.C. § 3729) exposure and a state scope-of-practice violation. AI may draft; a licensed human must review and sign.
4. **Emotion-targeting marketing AI.** Features that infer emotional state ("patient sounds anxious, send urgency-framed upsell") implicate FTC unfairness jurisprudence, the 2023 FTC AI policy statement, and likely OCR scrutiny for discriminatory impact on protected classes.
5. **Diagnosis inference from voice biometrics without authorization.** Anything that attempts to detect disease (cognitive decline, depression, COVID) from voice samples crosses into FDA medical-device territory (21 C.F.R. Part 892 / 892.2050) and requires 510(k) clearance or de novo authorization. Not within the CRM's intended scope.

---

## 8. What to Build Into the Demo

Credible compliance signals the demo mockup should surface for pilot prospects and outside reviewers:

- **"Consent required" badges** adjacent to every AI outbound affordance (send-SMS, dial, auto-call). Button disabled + tooltip on missing consent.
- **Recording-disclosure script** pre-filled per state on the outbound-call modal, with a "recipient confirmed" checkbox before dial.
- **TCPA opt-in + opt-out fields** visible on the contact form, with source (form / verbal / import) and timestamp shown.
- **Audit-log entry** surfaced for every AI action: draft, edit, send, receive, transcribe.
- **Supervised Mode** as the default posture: AI drafts, a human operator stamps and sends. An "Autonomous Mode" toggle exists only on a per-tenant feature flag and only after the tenant signs a separate addendum.
- **BAA inventory page** showing the vendors currently under BAA (AWS, WorkOS, selected LLM + voice providers) with signed-date.
- **Per-tenant PHI-redaction preview** in the AI-draft pane so the customer can see exactly what is shipped to the model.

---

## 9. Bottom Line

### 9.1 Cheapest compliant path today (lean stack, HIPAA-only)

1. Sign BAAs with AWS, Anthropic (or chosen LLM), Twilio (or chosen telephony), Deepgram / AssemblyAI (or chosen STT), WorkOS, and any fax vendor — **before** any live PHI.
2. Default every AI outbound to Supervised Mode. Ship the UI with the toggles and badges above, not marketing-only copy.
3. Build consent + audit schema per § 6. No AI send fires without a passing consent check.
4. Default recording scripts to all-party wording; state-match only as an override.
5. Author a one-page Incident Response Plan, tabletop it once, and store in tenant-facing trust center.
6. Carry cyber-liability insurance at or above the pilot tenant's contract floor (typically $1M / $3M for HH/hospice).
7. Keep Part 2 handling behind a feature flag until a tenant with SUD-adjacent patients contracts; do not comingle pipelines.
8. SOC 2 deferred until a pilot contract requires it; in the interim, publish a HIPAA attestation + controls matrix.

### 9.2 When to stop DIY and bring in outside counsel

Call counsel **before**:

- Signing the first paid pilot contract (BAA + DPA negotiation, indemnity scope).
- Sending the first live AI-initiated outbound message to a real patient or referral source.
- Recording the first real outbound call in a two-party state.
- Enabling Autonomous Mode for any tenant.
- Any breach or suspected PHI exposure.
- Any TCPA / CIPA / state-AG demand letter, subpoena, or class-action notice.
- Any OCR inquiry, however informal.

### 9.3 Disclaimer

This memo is engineering guidance. It is not legal advice, creates no attorney-client relationship, and does not substitute for review by licensed counsel in each jurisdiction of operation. Regulatory landscape, especially around AI voice and TCPA, is moving quickly — re-verify cited rules within 30 days of production launch and at each subsequent tenant onboarding. Outside counsel review is required before the first live AI-initiated outbound communication.

---

## Revision history

- 2026-04-23: Initial draft (Writer agent) covering TCPA, HIPAA, state recording laws, 42 CFR Part 2, CMS CoPs, consent architecture, red flags, demo requirements, bottom line.
