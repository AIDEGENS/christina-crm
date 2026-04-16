# Post-MVP — Weeks 3-10

> After the demo succeeds, this is the full-build roadmap. Detailed step files to be written once MVP demo confirms the direction.

## Weekly breakdown

### Week 3 — AI intake + eligibility
- `week-3.1-bedrock-fax-parsing.md` — AWS Bedrock Claude Sonnet 4.6 extraction from PDFs
- `week-3.2-ses-inbound.md` — SES receives eFax emails → S3 → Inngest → Bedrock
- `week-3.3-stedi-eligibility.md` — Stedi 270/271 auto-check on new referrals
- `week-3.4-denial-risk-hook.md` — call claims platform scrubber API for risk score

### Week 4 — BD + reports
- `week-4.1-bd-visit-logging.md` — visit form, GPS capture, linked to org
- `week-4.2-bd-mobile-pwa.md` — service worker, offline visit queue, sync on reconnect
- `week-4.3-reports.md` — velocity, BD scorecard, payer mix, SLA, lost reasons
- `week-4.4-csv-pdf-export.md` — server-side render to CSV/PDF with PHI minimum

### Week 5 — Notifications + accounting
- `week-5.1-twilio-sms.md` — Twilio with BAA, alerts for SLA breach / new referral
- `week-5.2-quickbooks-integration.md` — QB Enterprise API, invoice tracking
- `week-5.3-audit-log-ui.md` — admin view of audit log with filters + export

### Week 6 — Migration prep
- `week-6.1-wellsky-csv-import.md` — parse WellSky exports, map fields, dedupe
- `week-6.2-dual-run-setup.md` — dual data entry avoidance, reconciliation
- `week-6.3-import-orgs-contacts.md` — first import pass for reference data

### Week 7 — Migration execution
- `week-7.1-historical-referrals-import.md` — 6-12mo of referrals imported
- `week-7.2-user-training.md` — Clay + Sarah training sessions
- `week-7.3-pilot-smoke-test.md` — 1 real referral end-to-end in production

### Week 8 — Security review
- `week-8.1-pen-test-lite.md` — OWASP top 10 review, SAST scan, dependency audit
- `week-8.2-dr-drill.md` — RDS snapshot restore test, RTO/RPO validation
- `week-8.3-baa-verification.md` — confirm all BAAs current, re-sign if expiring

### Week 9 — Hardening
- `week-9.1-performance-testing.md` — 100 concurrent users, RDS index tuning
- `week-9.2-observability.md` — Datadog dashboards, alerts, SLO definitions
- `week-9.3-backup-validation.md` — daily snapshot verification, cross-region copy

### Week 10 — Cutover
- `week-10.1-cutover-criteria.md` — go/no-go checklist
- `week-10.2-full-cutover.md` — client stops using WellSky BD layer
- `week-10.3-post-cutover-monitoring.md` — 2 weeks of hypercare, daily standups
- `week-10.4-soc2-kickoff.md` — start Vanta/Drata onboarding for Type 1

## Shared infrastructure

All of these depend on:
- Phase 0 completed (AWS, Postgres, WorkOS, Vercel)
- MVP demo completed and approved
- BAAs signed for any new vendors (Twilio, QuickBooks Enterprise)
- Inngest Enterprise account provisioned (was deferred from MVP)

## Reference
- `../../REF/CRM-10-ROADMAP.md` — full roadmap
- `../../REF/CRM-07-INTEGRATIONS.md` — integration inventory
- `../../REF/CRM-09-MIGRATION-FROM-WELLSKY.md` — migration strategy
- `../../Insurance Claims/REF/STRATEGY.md` — parent platform roadmap

## When to write detailed step files

Write the detailed step files for each week **during that week**, not in advance. Spec drift happens fast when assumptions are written too early. Use the template at `../_templates/step-template.md` and follow the pattern from Phase 0 files.
