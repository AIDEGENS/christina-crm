# CRM-05 — Feature Spec v1

> MoSCoW prioritization. **Must** = launches in v1 or product is useless. **Should** = strong expectation, cut only if timeline demands. **Could** = nice to have. **Won't** = explicitly deferred.

## Must have

### M1. AI-powered fax/email intake
- Fax/email arrives → PDF stored in S3 → Claude Sonnet extracts fields
- Extracted fields: patient initials, age, sex, dx codes, payer, orders, discharge date, source org, referring physician
- Confidence score (0-1) displayed on intake card
- One-click accept → creates referral in pipeline
- "Needs review" flag if confidence < 0.8 or missing critical fields
- Audit log entry for every extraction

**Acceptance criteria:** Given a 3-page fax from a hospital case manager, the system extracts at least 10/12 standard fields with >85% accuracy in under 15 seconds.

### M2. Referral pipeline (kanban)
- 5 columns: New, Eligibility, SOC Scheduled, Admitted, Lost/Denied
- Drag-and-drop between columns (or button action)
- Each card shows: patient initials, age, sex, primary dx, payer badge, source org, time in stage, assigned user
- SLA indicator: yellow at 12h, red at 24h without action
- Filter by: assigned user, payer, source org, date range
- Status change triggers audit log + optional notification

**Acceptance criteria:** Intake coordinator can move a referral from New to SOC Scheduled in 3 clicks or fewer.

### M3. Automated eligibility check
- On referral intake, auto-trigger Stedi 270/271 with patient payer info
- Result stored on referral: verified / failed / pending
- Failed eligibility shows alert with HETS response detail
- Re-check button for manual re-trigger
- Transaction ID stored for audit

**Acceptance criteria:** Eligibility result returned within 30 seconds of referral creation for Medicare Part A patients.

### M4. Organization management
- CRUD for hospitals, SNFs, physician practices
- Fields: name, type, NPI, address, phone, fax, assigned BD rep, notes
- Scorecard: 30-day referrals, conversion %, avg episode value, last contact date
- "Stale" flag if no BD contact in >10 days
- NPI auto-lookup from NPPES on create

**Acceptance criteria:** BD rep can see which orgs haven't been visited in 10+ days from the org list view.

### M5. Contact directory
- People at organizations: physicians, case managers, discharge planners
- Fields: name, title, role, NPI (physicians), phone, email, preferred contact method
- Linked to organization
- Searchable by name, NPI, org, role

### M6. Dashboard
- KPI tiles: new referrals (7d), conversion to SOC %, avg referral-to-SOC time, active episodes, 1st-pass approval rate (from scrubber)
- Referral velocity chart (14d trend, inbound vs admitted)
- Top referral sources bar chart
- Recent activity feed
- "Needs attention" panel: SLA breaches, failed eligibility, unassigned referrals

### M7. Multi-tenant with RLS
- Tenant switcher in top nav for users with access to multiple agencies
- All queries filtered by `tenant_id` via Postgres RLS
- Users see only their tenant's data
- Admin role can manage users within their tenant

### M8. Audit log
- Every PHI read, write, export logged
- Append-only table, separate from application data
- Columns: user, action, resource, IP, timestamp
- 6-year retention (HIPAA §164.316)
- Admin can view audit log in settings

### M9. Referral detail view
- Full patient card with clinical summary, timeline, documents, notes
- Timeline shows: intake → extraction → eligibility → SOC → admission
- Document viewer (PDF in-browser from S3 presigned URL)
- Notes with user attribution + AI auto-notes
- Action buttons: assign nurse, move stage, print H&P
- PHI access logged on view

### M10. WorkOS auth
- SSO + MFA via WorkOS
- Roles: admin, intake, bd_rep, viewer
- Role-based access: bd_rep cannot see PHI clinical details; intake cannot manage users
- Session management with timeout (15 min inactivity)

## Should have

### S1. BD rep mobile view
- Responsive PWA, not separate native app
- Today's route: list of org stops with time slots
- Org detail: scorecard, contacts, visit log
- One-tap visit logging with GPS capture
- Offline mode: visit logs sync when online

### S2. Reports with export
- Referral velocity by source
- BD rep scorecard (visits, contacts, referrals per rep)
- Payer mix breakdown
- SLA compliance report
- Lost-reason analysis
- Export: CSV, PDF

### S3. Email/SMS notifications
- New referral assigned to you (email + push)
- Referral SLA breach approaching (email)
- Eligibility check failed (email to assigned user)
- Via SES (email) and Twilio (SMS) — both have BAA

### S4. Denial risk integration
- On referral intake, call claims platform scrubber API
- Display denial risk score (0-100) on referral card
- If risk > 60, flag for review before proceeding

## Could have

### C1. Batch fax intake
- Multiple referrals in a single fax (e.g., Kaiser sends 3 at once)
- AI splits and parses each separately
- Batch accept/reject

### C2. E-referral portal
- Public-facing form for hospital case managers to submit referrals directly
- Form → referral in pipeline (skips fax parsing)
- Branded per tenant

### C3. Organization heat map
- Geographic view of referral sources on a map
- Color-coded by volume, conversion, staleness
- BD rep route optimization suggestions

### C4. Custom fields
- Tenant-level custom fields on referrals, orgs, contacts
- Stored in `metadata` jsonb column
- Filterable and reportable

## Won't have (v1)

- Clinical documentation (OASIS-E, HIS, visit notes)
- eMAR / medication management
- Scheduling / clinician routing
- 837I generation (handled by claims platform)
- Billing / RCM / collections
- HL7 FHIR integration
- Video/telehealth
- Patient portal
- Custom ML models (Bedrock prompts are sufficient)
