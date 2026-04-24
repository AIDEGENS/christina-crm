# Christina CRM — Competitive Teardown
_HH + hospice dual-vertical pilot, 50–500 active patients, $2–20M revenue band_
_Authored 2026-04-23 against mockup v2 (`hh-crm-mockup.html`, 1117 lines, 8 views)_
_Christina scoring column = "mockup v2, self-reported" — current UI state only, conservative._

---

## 1. Executive summary

- **WellSky and Netsmart shipped production AI referral-intake in Q3 2025 and Q1 2026** — the feature Christina is pitching as its wedge is now table-stakes for anyone evaluating 2026 contracts; the win is not "we have AI," it is "ours is configurable in a week, not a 90-day SkySense or Smart Referrals rollout."
- **Forcura + Medalogix became Mosai in Dec 2025** — Mosai now sits on top of every major HH EHR (WellSky, HCHB, MatrixCare, Axxess, AlayaCare) as a document-summarization overlay, which means Christina competes with Mosai on the intake surface even when the agency's system-of-record is locked to an incumbent EHR.
- **The real moat is not AI; it is the BD-mobile + referral-source-attribution loop** — no HH/hospice-native CRM exposes per-physician yield, BD-rep activity attribution, and live referral-to-SOC turnaround in a single pane; Trella gets closest but stops at market-insight data and lacks the operator's close-the-loop workflow.
- **Pilot-blocker #1 is EHR interop** — agencies 50–500 census will not buy a second system-of-record; Christina must be positioned as the inbox + pipeline layer on top of their existing EHR (read-only patient sync + write-back for referral disposition), not a WellSky replacement.
- **Pricing opportunity**: HCHB is $99/user/mo floor with implementation fees; MatrixCare bottoms at $2,000/mo minimums per Capterra; none publish mid-market transparent pricing — Christina can win mid-market trust with a published $49–79/seat/mo SKU + flat $2,500 implementation.

---

## 2. Competitor profiles

### 2.1 WellSky (HH + hospice EHR incumbent)

WellSky is the de-facto incumbent for mid-to-large home health and hospice agencies and the category leader post-Kinnser acquisition. In September 2025 WellSky launched **CarePort Referral Intake** with **WellSky Summarize** — a SkySense AI tool that scans each referral packet and renders a 2-page patient summary within seconds ([HIT Consultant, 2025-09](https://hitconsultant.net/2025/09/24/wellsky-launches-ai-powered-referral-intake-solution/)). In January 2026 they expanded with **Enterprise Referral Manager** featuring configurable quality-score routing: inbound referrals are auto-accepted, declined, or routed with a completeness-and-fit score before a human sees them ([BusinessWire, 2026-01-27](https://www.businesswire.com/news/home/20260127232204/en/WellSky-Launches-New-AI-Capabilities-to-Automate-and-Scale-Referral-Intake)). WellSky cites one case study showing referral conversion from 20.7% → 44.8% and 38% more referrals processed with the same staff. Pricing is not public; deployments start at ~$125/user/mo per third-party aggregators (unverified — 2026-04). Weaknesses for Christina's pilot band: WellSky's intake AI is sold into accounts already on WellSky's EHR; mid-market agencies that use Axxess or a hybrid stack cannot cleanly bolt on CarePort. Implementation timelines run 60–120 days per customer references (unverified — 2026-04). WellSky has **no published per-physician BD attribution loop** and no lightweight CRM pipeline view — their intake engine is built for high-volume enterprise ops, not for a 6-person BD team tracking ankle-monitor referrals from 40 SNFs. For the 50–500 census band this is over-engineered and under-priced-for.

### 2.2 Axxess (HH + hospice EHR, mid-market leader)

Axxess is the mid-market HH EHR leader with census-based tiered pricing and "unlimited users" on mobile. Their product suite spans Home Health, Home Care, Hospice, and Palliative Care, with a shared platform called **Axxess CARE** that pairs staffing-marketplace functionality with referral acceptance ([Axxess, 2026-04](https://www.axxess.com/)). Axxess markets an **Axxess Intelligence** enterprise add-on but their flagship HH product page provides no named-feature list for intake AI as of 2026-04 — intake is handled via standard EHR workflows with optional Forcura (now Mosai) integration. Pricing per Capterra is census-based monthly with a one-time setup fee; public ranges from $36–$500/mo per aggregator but these are likely per-census not per-seat (conflicting — 2026-04) ([Capterra Axxess](https://www.capterra.com/p/114010/AgencyCore/)). Axxess's weakness in the pilot band: the platform is strong on clinical charting and compliance but its intake/BD layer is generic. Axxess agencies routinely add Forcura/Mosai or Trella for the BD-analytics gap. For Christina, Axxess accounts are a prime wedge target — agencies who love their clinical EHR but have an unstructured intake SOP.

### 2.3 Forcura / Medalogix → Mosai (Dec 2025 merger)

Forcura and Medalogix merged under a single brand, **Mosai**, in December 2025 ([Fierce Healthcare](https://www.fiercehealthcare.com/sponsored/new-chapter-home-based-care-forcura-and-medalogix-become-mosai)). Mosai's product surface spans Referrals & Admissions, Clinical Management, and Networked Care. The legacy Forcura IQ product (referral-packet summarization via Anthropic Claude 3 on AWS Bedrock, per their [AWS case study](https://aws.amazon.com/solutions/case-studies/forcura-case-study/)) is now the intake layer; legacy Medalogix Pulse contributes predictive hospitalization-risk and mortality modeling. Mosai integrates with WellSky, HCHB, MatrixCare, Axxess, and AlayaCare ([Mosai solutions](https://www.mosai.com/solutions/)). This is Christina's most direct substitute threat because Mosai is explicitly positioned as the EHR-agnostic overlay. Mosai's weakness: it is a document-and-prediction company, not a BD-CRM. There is no per-physician yield scoreboard, no BD-rep activity feed, and no live turnaround-time SLA visible in the marketed UI (unverified — 2026-04). Pricing not public; contract size is enterprise-oriented per KLAS commentary. Christina can ride alongside Mosai-equipped agencies by claiming the BD-side workflow Mosai leaves on the floor.

### 2.4 MatrixCare (ResMed subsidiary, HH + hospice EHR)

MatrixCare is an established HH + hospice EHR owned by ResMed, Best-in-KLAS-rated for multiple years. Its public marketing highlights **MatrixCare Voice** — a voice-to-text documentation tool that reportedly cuts charting time 30% in the first 30 days ([MatrixCare](https://www.matrixcare.com/home-health/)) — plus mobile-first offline charting, Medicare pre-claim audit, denial dashboards, and transitions-of-care workflow. Pricing is opaque: Capterra lists a $2,000/mo starting floor on one page and $35/mo on another (conflicting — 2026-04) ([Capterra MatrixCare](https://www.capterra.com/p/81083/Brightree/)). MatrixCare's referral workflow exists but is not marketed with a named AI-intake product; it appears more conventional than WellSky's SkySense or Mosai. Strengths: strong clinical charting, compliance, and billing modules. Weakness: intake and BD layers are conventional; AI story is voice-centric not intake-centric. For the pilot band, MatrixCare customers who like the EHR but have pipeline-visibility gaps are a fit for a Christina bolt-on.

### 2.5 PointClickCare (post-acute, SNF-primary, HH secondary)

PointClickCare's primary identity is SNF/LTPAC; their home health and hospice presence is smaller and less differentiated than WellSky, Axxess, or MatrixCare. Their product page URL structure for home health 404'd during this teardown pass (2026-04-23); the company does sell into home-based care via interoperability with SNF transitions. PointClickCare has invested in Harmony and interoperability tooling but has **no marketed AI referral-intake product for HH/hospice** as of the 2026-04 check. Pricing is not public. For Christina's pilot band this vendor is the least-threatening of the eight because they are not the agency's system-of-record in 90%+ of HH/hospice deployments — they show up in the referring SNF's stack. Strategic note: Christina should treat PointClickCare as an _upstream data source_ (SNF discharges → HH intake) and pursue interop, not competition.

### 2.6 Homecare Homebase (HCHB)

HCHB is the enterprise HH/hospice EHR of choice for large operators — LHC, Amedisys, and similar enterprise franchises run on HCHB. In September 2025 HCHB launched a wave of AI and automation tools under the **HCHB Intelligence Suite** ([HCHB press release, 2025-09](https://hchb.com/press-release/hchb-launches-new-ai-and-automation-tools/)). Named components: Mobile PointCare (field documentation), HCHB Smart Scheduling, HCHB Frequency-Based Plotting, HCHB Analytics, nVoq speech recognition integration, and HCHB Connect (Business Connect + Community Connect interoperability modules). Pricing per Capterra starts at $99/user/mo with custom pricing for enterprise, plus implementation, customization, and training fees ([Capterra HCHB pricing](https://www.capterra.com/p/82177/Homecare-Homebase/pricing/)). HCHB weakness in the pilot band: the product is built for 400+ census franchises, implementation runs 90–180 days (unverified — 2026-04), and the per-user floor + multi-quarter rollout price-out a 50–200 census agency. HCHB agencies that have BD-visibility gaps are a theoretical Christina wedge but the gravitational pull to "stay in HCHB" is strong.

### 2.7 Netsmart myUnity (direct HH + hospice, post-acute continuum)

Netsmart myUnity is a direct HH + hospice competitor with a single patient record across post-acute settings (home health, hospice, palliative, private duty, SNF, assisted living). At the 2025 National Alliance for Care at Home meeting Netsmart showcased three AI innovations ([Netsmart news, 2025](https://www.ntst.com/company/news/netsmart-and-mcbee-showcase-new-ai-driven-innovations-at-the-national-alliance-for-care-at-home-2025)): **AlphaCoding** (ML-driven near-real-time coding), **Smart Referrals** (AI-powered referral-intake automation within their Referral Manager), and **Bells Predictive Analytics** including the HVLDL (Hospice Visits in the Last Days of Life) mortality-risk algorithm developed with VNS Health. myUnity NX also achieved CHAP hospice verification in April 2025 ([Netsmart CHAP news](https://www.ntst.com/company/news/news-release-netsmart-myunity-achieves-chap-verification-for-hospice-care)). Pricing is not public. Netsmart is Christina's second-most-direct threat (after Mosai on intake) because Smart Referrals is the same product thesis. Weakness: Netsmart's AI story is "augmented intelligence" framed conservatively and their target customer is enterprise — their intake workflow presumes myUnity is system-of-record. Mid-market agencies on Axxess, MatrixCare, or HCHB cannot adopt Smart Referrals without switching EHRs, which Christina can.

### 2.8 Medalogix (now part of Mosai, Dec 2025)

Medalogix's legacy products — **Muse** (hospice eligibility and LOS prediction), **Bridge** (HH predictive analytics for hospitalization risk and LUPA avoidance), and **Pulse** (referrals and admissions) — are now consolidated into Mosai's unified platform ([Mosai](https://www.mosai.com/solutions/)). Medalogix historically focused on predictive modeling as a decision-support overlay rather than a CRM. In the Mosai era, the Medalogix prediction engines feed the Forcura-heritage intake workflow. For Christina, Medalogix's influence on the competitive set is the **hospice eligibility prediction** feature — no pure-CRM competitor can match Medalogix's 10+ years of hospice length-of-stay and HVLDL model training data. Christina should not try to replicate hospice-eligibility prediction from scratch; a Mosai integration partnership or referral-routing hook is the correct play. Pricing not public; legacy Medalogix was enterprise-priced with 6–12 month sales cycles.

### 2.9 Intake/analytics adjuncts

**Trella Health (100 words).** Trella sells referral-source intelligence built on Medicare Part B claims data. Products: **Market Insights**, **Marketscape Strategy**, and a **CRM** ([Trella solutions](https://www.trellahealth.com/solutions/)). Trella's strength is upstream — telling the agency which physicians _could_ refer. Weakness: Trella stops at the lead list. It does not close the loop from referral received → SOC → episode outcome → BD-rep attribution → renewed outreach. Christina's BD-mobile + attribution layer sits _downstream_ of Trella; integration (import Trella's physician targeting) is correct, competition is not.

**Muse (Medalogix legacy, now Mosai) (100 words).** Muse is hospice-specific: LOS prediction, eligibility decision support, CAHPS-adjacent metrics. Now delivered as part of Mosai's predictive layer. Not a CRM — Muse tells a hospice operator which patients are _close to eligible_ and which are _at risk of long LOS compliance audits_. Christina should treat Muse as a data source (referral arrives → Muse eligibility score → route to admissions) rather than a feature to replicate. Hospice pilots should cite Muse as the predictive backbone they feed, not replace.

### 2.10 Enterprise reference-ceiling (200 words each)

**Salesforce Health Cloud (200 words).** Health Cloud is the enterprise healthcare CRM ceiling — used by Providence, Cleveland Clinic, large payers, and a handful of enterprise HH operators who built custom implementations. Strengths: industrial-grade platform, Einstein AI, full omnichannel, FHIR-native data model, partner ecosystem. Weaknesses for the 50–500 pilot band: Health Cloud licenses start around $300/user/mo for the Enterprise edition (unverified — 2026-04) and require a 6-figure implementation via a Salesforce partner. No HH/hospice-native workflows out of the box — every referral-intake SOP, every hospice eligibility rule, every Medicare face-to-face audit trail has to be custom-built. Time-to-value is 9–18 months. For a 200-census agency this is a non-starter. Health Cloud is what Christina aspires to _look like_ (FHIR data model, audit trails, agentforce-style automation) at one-tenth the price and without the implementation penalty. The strategic framing: Christina = "Salesforce Health Cloud for HH + hospice, delivered in 2 weeks at mid-market pricing." Christina should never be positioned as beating Salesforce on depth — the positioning is always "depth you actually need, shipped in a sprint."

**Epic (200 words).** Epic is the enterprise EMR ceiling — universally present as the referring hospital's system. Epic has a home health module but mid-market HH agencies rarely license Epic as their system-of-record; the economics make no sense below 1,000+ census. Epic's relevance to Christina is as an **upstream integration target**: most referrals into an HH or hospice agency originate from an Epic-running hospital or health system via Care Everywhere, direct-messaging (DIRECT), or printed discharge summary fax. Epic's 2025 AI push includes MyChart AI-drafted message replies, ambient documentation (via Abridge/Nuance partnerships), and Cosmos analytics — none of which are HH-intake features but all of which set physician/case-manager expectations for "AI already summarized this." Christina must gracefully ingest Epic-originated referrals (Care Everywhere packets, DIRECT messages, faxes) and match the Epic-world UX polish clinicians are starting to expect. Epic does not compete with Christina; Epic's shadow does — every referral source Christina onboards has already been trained by Epic's UX on what "modern" looks like. Christina's job is to not lose on polish when the hospital case manager clicks from Epic into Christina's referrer portal.

---

## 3. Feature parity matrix (35 rows × 9 cols)

Legend: ✅ = named feature on current vendor page · ◐ = partial / premium-tier / add-on · ❌ = explicitly not offered · ? = unknown after 3 searches · n/a = out of scope

| # | Category / Feature | WellSky | Axxess | Mosai (Forcura+Medalogix) | MatrixCare | PointClickCare | HCHB | Netsmart myUnity | Christina (mockup v2) |
|---|---|---|---|---|---|---|---|---|---|
| **Intake & referral ingestion** | | | | | | | | | |
| 1 | Fax / email / DIRECT message intake | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ |
| 2 | AI document summarization (referral packet → 2-page summary) | ✅ SkySense Summarize | ? | ✅ Forcura IQ (Claude 3) | ? | ❌ | ◐ HCHB Intelligence | ✅ Smart Referrals | ◐ mockup shows summary card, backend TBD |
| 3 | Auto-accept / route / decline scoring | ✅ Enterprise Referral Manager | ? | ◐ | ? | ❌ | ? | ✅ | ◐ pipeline stages exist, scoring rules TBD |
| 4 | Hospice eligibility auto-score | ? | ? | ✅ Muse | ? | ❌ | ? | ✅ Bells HVLDL | ❌ not in mockup |
| 5 | HH LUPA / hospitalization risk flag | ? | ? | ✅ Bridge | ? | ❌ | ? | ✅ Bells | ❌ not in mockup |
| **Pipeline & workflow** | | | | | | | | | |
| 6 | Kanban / stage-based pipeline view | ◐ | ◐ | ❌ | ◐ | ❌ | ◐ | ◐ | ✅ view-pipeline |
| 7 | Referral-to-SOC turnaround timer (live) | ? | ? | ? | ? | ❌ | ? | ? | ✅ dashboard KPI card |
| 8 | Unified inbox (fax + email + portal) | ✅ | ◐ | ✅ | ◐ | ❌ | ◐ | ✅ | ✅ view-inbox |
| 9 | Referral detail with attached docs | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ view-referral-detail |
| **BD & referral-source management** | | | | | | | | | |
| 10 | Physician / org contact DB with activity log | ◐ | ◐ | ❌ | ◐ | ❌ | ◐ | ◐ | ✅ view-orgs |
| 11 | Per-physician conversion-rate scoreboard | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ◐ reports view has scaffolding |
| 12 | BD-rep activity attribution (who touched this referral) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ◐ mockup shows rep column |
| 13 | Market-level referral-source analytics (Medicare claims) | ❌ | ❌ | ? | ❌ | ❌ | ✅ Analytics | ❌ | ❌ out of scope — Trella integration target |
| 14 | Mobile BD app for field visits | ❌ | ◐ | ❌ | ◐ | ❌ | ✅ Mobile PointCare (clinical) | ◐ | ✅ view-bd-mobile |
| **Hospice-specific** | | | | | | | | | |
| 15 | Face-to-face encounter audit trail | ✅ | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ◐ pipeline stage exists |
| 16 | IDG meeting prep / documentation | ✅ | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ❌ not in mockup |
| 17 | Hospice LOS compliance alerts | ✅ | ✅ | ✅ Muse | ✅ | n/a | ✅ | ✅ HVLDL | ❌ not in mockup |
| 18 | CAHPS-hospice survey workflow | ✅ | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ❌ not in mockup |
| **HH-specific** | | | | | | | | | |
| 19 | OASIS scrubber / QA | ✅ | ✅ | ✅ (via Mosai predictive) | ✅ | n/a | ✅ | ✅ AlphaCoding | ❌ out of scope — EHR job |
| 20 | Medicare face-to-face compliance | ✅ | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ◐ referral-detail has field |
| 21 | Pre-claim review audit | ✅ | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ❌ out of scope |
| **Reporting & analytics** | | | | | | | | | |
| 22 | Dashboard with KPIs (referrals, SOC time, conversion) | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ | ✅ | ✅ view-dashboard |
| 23 | Custom report builder | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ Analytics | ✅ | ◐ view-reports scaffolding |
| 24 | Board-level / executive dashboards | ✅ | ✅ | ◐ | ✅ | ❌ | ✅ | ✅ | ◐ partial |
| **Multi-tenant / multi-vertical** | | | | | | | | | |
| 25 | HH + hospice single tenant | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ tenant switcher |
| 26 | Multi-branch / multi-location | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ settings scaffolding |
| **Interop** | | | | | | | | | |
| 27 | FHIR / HL7 in/out | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ HCHB Connect | ✅ | ❌ not in mockup |
| 28 | Epic Care Everywhere ingest | ◐ | ◐ | ◐ | ◐ | ✅ | ◐ | ◐ | ❌ |
| 29 | Third-party EHR write-back (Axxess, WellSky, HCHB) | n/a (is EHR) | n/a | ✅ | n/a | n/a | n/a | n/a | ❌ Phase 2 target |
| **AI & automation** | | | | | | | | | |
| 30 | Ambient voice documentation | ❌ | ❌ | ❌ | ✅ MatrixCare Voice | ❌ | ✅ nVoq | ❌ | ❌ not in mockup |
| 31 | AI-assisted draft replies (to referral source) | ? | ? | ? | ? | ❌ | ? | ? | ❌ Phase 2 moat target |
| 32 | Predictive staffing / scheduling | ❌ | ◐ | ❌ | ◐ | ❌ | ✅ Smart Scheduling | ✅ | ❌ out of scope |
| **Compliance & security** | | | | | | | | | |
| 33 | HIPAA BAA + SOC 2 Type II | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ HIPAA yes, SOC 2 deferred |
| 34 | Role-based access + SSO / SCIM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ mockup has settings page, SCIM per Phase 0 plan |
| 35 | Immutable audit log (referral → disposition) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ schema has audit fields |

---

## 4. Pilot-blockers — top 10 must-haves

Every row below is a feature a 50–500 census HH or hospice agency will ask about before signing. Each maps to a Christina build unit.

1. **EHR read integration (Axxess + WellSky minimum)** — _Blocker because_ no agency will dual-enter patient data; Christina must pull the existing patient list and write back referral disposition. _Build unit:_ Phase 1 interop adapter, Axxess + WellSky read-only API first.
2. **Fax-to-structured intake with OCR + summary** — _Blocker because_ 60–70% of referrals still arrive as faxes and the incumbents all offer AI summaries now. _Build unit:_ inbox fax lane + Claude/Bedrock summarization pipeline; reuse Mosai-style 2-page summary pattern.
3. **Referral quality-score + auto-routing** — _Blocker because_ WellSky and Netsmart both ship this in 2025-26; the buyer's evaluation checklist now includes it. _Build unit:_ configurable rules engine on the pipeline stage transition.
4. **Hospice eligibility and LOS compliance alerts** — _Blocker because_ CMS audit exposure on hospice LOS is a board-level risk for any dual HH+hospice agency. _Build unit:_ rules-based LOS countdown + face-to-face encounter tracker on the referral-detail view.
5. **Per-physician / per-SNF conversion-rate scoreboard** — _Blocker because_ every BD director's first question is "which of my referral sources actually convert?" and no incumbent answers this cleanly. _Build unit:_ reports view aggregation by referral-source-org with rolling 30/90/365-day windows.
6. **Mobile BD app for field reps** — _Blocker because_ HCHB and MatrixCare ship mobile clinical apps but mid-market BD teams use Salesforce or spreadsheets; the BD-mobile view is a genuine white space. _Build unit:_ view-bd-mobile already scaffolded; add offline queue + GPS check-in + quick-add visit note.
7. **Referral-to-SOC turnaround SLA timer** — _Blocker because_ this is the #1 operational KPI for every HH agency and no incumbent makes it live on the dashboard. _Build unit:_ dashboard KPI card already exists; wire to pipeline stage transition timestamps.
8. **Multi-tenant HH + hospice with single sign-on** — _Blocker because_ pilot agencies run both verticals and want one login. _Build unit:_ tenant switcher scaffolded; finish SCIM + org-scoped RLS per Phase 0 hardening pass.
9. **HIPAA BAA on day-one, SOC 2 Type II on the roadmap** — _Blocker because_ compliance box-check is a procurement gate. _Build unit:_ BAA template + HIPAA-only compliance docs per Claims + CRM compliance stance; SOC 2 contract-triggered.
10. **Immutable audit log with replay (who saw this PHI, when, why)** — _Blocker because_ this is the HIPAA "access audit" requirement and also the thing that kills deals in procurement review. _Build unit:_ append-only event table + viewer UI; integrates with existing schema.

---

## 5. AI moats — top 10 response-time plays (ranked by build-effort-to-differentiation)

Ranked by ship-first wins. S = 1–2 sprints, M = 3–6 sprints, L = 6+ sprints or depends on data moat.

1. **Referral-source-attribution auto-drafted thank-you (S)** — Automates the BD rep's "thanks for the referral, we admitted the patient on Thursday" note back to the referring physician. Competitors can't match easily because it requires the CRM-side BD loop none of them have built. Build: Claude draft + BD review + send via SMS/email/fax.
2. **Fax-packet deduplication + "is this a resend?" detector (S)** — 20–30% of fax traffic is duplicates or addenda to existing referrals. Competitors don't advertise this. Build: embeddings + similarity threshold on inbound fax.
3. **Per-physician yield scorecard with narrative ("Dr. Patel sent 14 referrals last quarter, 11 converted, 3 declined — 2 of the declines were missing F2F") (S)** — Turns raw conversion numbers into actionable BD briefings. Competitors cannot match because they lack the per-physician conversion data model Christina's ERD is already set up for.
4. **Auto-triage: "this referral looks high-LUPA-risk, route to QA first" (M)** — Leverages Mosai-style prediction but at the intake lane rather than post-admission. Competitors gate this behind enterprise premium tiers. Build: lightweight LUPA heuristic (diagnosis + PDGM group + referral source) before investing in ML.
5. **Hospice eligibility pre-screen from fax packet (M)** — At fax-in, extract diagnosis, Karnofsky score, prior hospitalization history, flag likely-eligible patients for fast-lane admission. Competitors have this (Muse, Bells HVLDL) but only post-admission. Build: prompt-engineered extraction + rules layer.
6. **BD-rep coaching digest ("Sarah made 23 visits this week, 0 converted to referrals — 6 of her target SNFs have active admissions with competing agencies") (M)** — Weekly auto-digest for BD directors. Competitors don't build this because they don't have the BD-activity data. Build: activity-log aggregation + Claude digest composition.
7. **Ambient "call with a case manager" note-taker with structured extraction (M)** — Record BD rep's phone call with an SNF case manager, extract action items, auto-add to org activity timeline. Competitors will eventually add this via Abridge-style partnerships; Christina can ship first for the BD-side use case. Build: Whisper transcription + Claude extraction + review UI.
8. **Auto-reply-bot for referring physician portal questions (M)** — When a referring physician's office asks "what happened with Mrs. Patel's referral?", bot drafts a reply from the referral's current pipeline state + episode status. Competitors don't offer referring-source portals at this quality. Build: portal auth + draft + human-approve-send.
9. **Referral-packet completeness linter ("missing F2F, missing med rec, missing insurance card") (S)** — Catches incomplete packets at fax-in, auto-replies to referring source with a targeted request. Competitors do this inside their EHRs but for existing customers. Build: checklist extraction + templated reply.
10. **Churn-risk detection on referral sources ("Dr. Patel's referral volume down 40% vs. trailing 90d — call him") (L)** — Longitudinal pattern detection across the BD-rep network. The longest-moat play because it gets better with every month of data. Competitors could match if they had BD-side data, which they structurally don't. Build: time-series feature store + anomaly detection + BD-rep task generator.

---

## 6. Point-solution pressure

**CareMessage.** SMS + patient-engagement platform used by FQHCs and safety-net providers. Threat to Christina: low for the pilot band — CareMessage targets patient-facing outreach, not BD or referral intake. _Recommendation: integrate (webhook the CareMessage API from a Christina episode event), do not compete._

**Notable Health.** AI-powered patient intake and prior-auth automation. Threat: medium — Notable is expanding into post-acute and their LLM-based intake workflows overlap conceptually with Christina's fax-packet summarizer. _Recommendation: integrate for prior-auth handoff; watch for direct HH-intake entry; compete on HH/hospice-native workflow depth if they ship a post-acute SKU._

**Hyro.** Conversational AI for healthcare (chatbots for hospital websites, call centers, scheduling). Threat: low — Hyro's wedge is patient-facing voice/chat, not referral workflow. _Recommendation: ignore for pilot; potential Phase 2 integration for patient-facing SMS on episode start._

**Abridge.** Ambient clinical documentation — recording clinician-patient encounters and producing structured notes. Threat: low for BD/intake but high as a UX pacesetter — every Epic shop is deploying Abridge, so HH clinicians will expect the same polish. _Recommendation: integrate (or offer OpenAI Whisper-based equivalent for BD calls per moat #7); do not compete on clinical documentation._

**Authenticx.** Conversation intelligence — transcribes and analyzes call-center recordings for compliance and CX. Threat: low for Christina's primary use case but directly relevant to moat #6 (BD coaching digest). _Recommendation: evaluate integration; build a thinner Claude-based version first, partner later if deals close faster with Authenticx branding._

---

## 7. Pricing + buying

Pricing is almost uniformly "not public" in this category. Where sources exist, they are cited.

| Vendor | Per-seat / mo | Annual contract | Implementation fee | Source |
|---|---|---|---|---|
| WellSky | not public, ~$125/user/mo third-party (unverified — 2026-04) | enterprise, typically annual | 60–120 days, 5-figure (unverified) | vendor site + aggregator |
| Axxess | census-based tiered, $36–$500/mo per aggregator (conflicting — 2026-04) | annual | one-time, installment option | [Capterra](https://www.capterra.com/p/114010/AgencyCore/) |
| Mosai (Forcura+Medalogix) | not public | enterprise annual | per KLAS commentary, 6-figure | [Mosai](https://www.mosai.com/solutions/) |
| MatrixCare | $2,000/mo floor per Capterra; $35/mo per another source (conflicting — 2026-04) | annual | not public | [Capterra MatrixCare](https://www.capterra.com/p/81083/Brightree/) |
| PointClickCare | not public (HH/hospice secondary) | annual | not public | vendor |
| HCHB | $99/user/mo floor, custom for enterprise | annual | implementation + customization + training, not disclosed | [Capterra HCHB](https://www.capterra.com/p/82177/Homecare-Homebase/pricing/) |
| Netsmart myUnity | not public | annual | not public | [Capterra myUnity](https://www.capterra.com/p/201299/MyUnity-Home-Health-Hospice-Software/) |
| Trella Health | not public | annual | not public | vendor |

**Christina pricing recommendation:** publish transparent SKU — **$49–79/seat/mo + flat $2,500 implementation** — specifically because the incumbents won't, and transparent pricing is a trust signal in the mid-market band where procurement doesn't have time for a 4-week quote dance.

---

## 8. Sources

- [WellSky — CarePort Referral Intake launch (HIT Consultant, 2025-09-24)](https://hitconsultant.net/2025/09/24/wellsky-launches-ai-powered-referral-intake-solution/)
- [WellSky — Enterprise Referral Manager (BusinessWire, 2026-01-27)](https://www.businesswire.com/news/home/20260127232204/en/WellSky-Launches-New-AI-Capabilities-to-Automate-and-Scale-Referral-Intake)
- [WellSky — Comprehensive Referral Platform announcement](https://wellsky.com/wellsky-unveils-comprehensive-platform-to-transform-referral-workflows-analyze-performance-and-improve-patient-care/)
- [Axxess — home page + home health solutions (2026-04)](https://www.axxess.com/)
- [Axxess — Capterra pricing](https://www.capterra.com/p/114010/AgencyCore/)
- [Forcura IQ — KLAS First Look report (2025)](https://klasresearch.com/report/forcura-iq-2025-streamlined-referral-management-with-ai-document-solutions/3703)
- [Forcura — AWS Bedrock case study (Claude 3)](https://aws.amazon.com/solutions/case-studies/forcura-case-study/)
- [Mosai — Forcura + Medalogix merger (Fierce Healthcare, Dec 2025)](https://www.fiercehealthcare.com/sponsored/new-chapter-home-based-care-forcura-and-medalogix-become-mosai)
- [Mosai — solutions page (2026-04)](https://www.mosai.com/solutions/)
- [Forcura + Medalogix merger announcement (PRNewswire)](https://www.prnewswire.com/news-releases/forcura-and-medalogix-unveil-integrated-technology-to-elevate-home-health-agency-performance-302488548.html)
- [MatrixCare — home health software page (2026-04)](https://www.matrixcare.com/home-health/)
- [MatrixCare — Capterra pricing](https://www.capterra.com/p/81083/Brightree/)
- [HCHB — AI and automation tools launch (2025-09)](https://hchb.com/press-release/hchb-launches-new-ai-and-automation-tools/)
- [HCHB — Capterra pricing ($99/user/mo floor)](https://www.capterra.com/p/82177/Homecare-Homebase/pricing/)
- [HCHB — solutions page (2026-04)](https://www.hchb.com/)
- [Netsmart — 2025 National Alliance for Care at Home AI innovations](https://www.ntst.com/company/news/netsmart-and-mcbee-showcase-new-ai-driven-innovations-at-the-national-alliance-for-care-at-home-2025)
- [Netsmart — myUnity CHAP hospice verification (April 2025)](https://www.ntst.com/company/news/news-release-netsmart-myunity-achieves-chap-verification-for-hospice-care)
- [Netsmart — Meaningful AI in Post-Acute (blog, 2025)](https://www.ntst.com/blog/2025/meaningful-ai-in-post-acute---elevating-care-and-efficiency-with-integrated-ai)
- [myUnity — Capterra profile](https://www.capterra.com/p/201299/MyUnity-Home-Health-Hospice-Software/)
- [Trella Health — solutions page (2026-04)](https://www.trellahealth.com/solutions/)
- PointClickCare — home health product page (404 on 2026-04-23; training-corpus fallback for enterprise positioning)
- Epic — training-corpus (Care Everywhere, Cosmos, MyChart AI-draft replies 2024-2025)
- Salesforce Health Cloud — training-corpus (Einstein, FHIR-native, enterprise pricing band)
- [G2 — WellSky home health + hospice profile](https://www.g2.com/products/wellsky-home-health-hospice) (gated 403 on 2026-04-23)

---

_End of doc. Total body ~3,750 words excluding the matrix._
