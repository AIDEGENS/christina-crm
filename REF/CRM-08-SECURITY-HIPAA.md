# CRM-08 — Security & HIPAA

> CRM-specific security controls. For the full compliance framework, see `Insurance Claims/REF/REGULATIONS.md` and `Insurance Claims/REF/BAA-CHECKLIST.md`. This doc adds CRM-layer specifics.

## PHI in the CRM

The CRM handles PHI at every layer. The following fields are PHI and must be encrypted at rest + in transit:

- Patient DOB, MRN, address, payer member ID, full name (stored but never displayed — initials used for UI)
- Referring physician contact info (arguably not PHI, but treat as sensitive)
- Fax/email PDFs in S3 (contain full patient records)
- Notes authored by intake coordinators (may reference patient details)

## Encryption

| Layer | Method |
|---|---|
| At rest (RDS) | AES-256 via AWS KMS (RDS default encryption + column-level for sensitive fields) |
| At rest (S3) | SSE-KMS with per-tenant KMS key |
| In transit | TLS 1.3 everywhere — ALB, Vercel, API calls, Stedi, WorkOS |
| Bedrock prompts | TLS in transit; Bedrock does not store prompts/responses |

## Access control

| Role | Can see | Cannot see |
|---|---|---|
| **admin** | Everything within tenant | Other tenants |
| **intake** | Referrals, pipeline, docs, notes, orgs, contacts | User management, billing, other tenants |
| **bd_rep** | Organizations, contacts, BD visits, referral cards (no clinical detail) | Full patient PHI, documents, clinical notes |
| **viewer** | Dashboard, reports (de-identified aggregates) | Individual referral details, PHI |

Implemented via:
- WorkOS roles → mapped to app-level permissions
- Postgres RLS on `tenant_id`
- Application-layer permission checks on sensitive fields (bd_rep cannot query `patient_dob`, `patient_mrn`, etc.)

## Session security

- WorkOS session management
- 15-minute inactivity timeout (configurable per tenant)
- MFA required for admin role
- MFA recommended for intake (configurable)
- Session tokens stored in httpOnly, Secure, SameSite=Strict cookies

## Audit log requirements

Every PHI interaction generates an audit entry:

| Action | Logged |
|---|---|
| View referral detail | `read_referral` with referral_id |
| Edit referral | `update_referral` with field-level diff |
| View/download document | `read_document` with s3_key |
| Export report | `export_report` with report_type and row count |
| AI extraction | `ai_extraction` with confidence and model_id |
| Eligibility check | `eligibility_check` with Stedi txn_id |
| Login / logout | `auth_login` / `auth_logout` |
| Failed login | `auth_failed` |
| Role change | `role_changed` |

Retention: 6 years (HIPAA §164.316).
Storage: Separate `crm.audit_log` table with restricted access. Admin can view but not modify.

## Breach notification

Per HITECH (45 CFR §164.404-410) and California (Cal. Civ. Code §1798.82):
- Discovery → notification within 60 calendar days
- If 500+ individuals → media notification required
- Platform must support: identifying affected records, generating notification lists, providing breach timeline

The CRM audit log is the primary forensic data source for breach investigation.

## BAA chain

The CRM inherits the platform's BAA chain. No additional BAAs needed beyond those tracked in `BAA-CHECKLIST.md`, **unless** we add:
- Twilio for SMS → Twilio BAA required (available on paid plan)
- Any new SaaS vendor → check BAA-CHECKLIST.md process first

## Minimum necessary rule

45 CFR §164.502(b): only access/display the minimum PHI necessary for the task.

CRM implementation:
- Pipeline kanban cards show **initials + age + dx code + payer** only — not full name, DOB, MRN
- Full PHI visible only on referral detail view (requires click-through + audit log entry)
- Reports show **aggregated/de-identified** data by default
- BD rep role sees org/contact data but NOT patient clinical details
- Exported CSVs strip full PHI unless admin explicitly enables it (with audit log)
