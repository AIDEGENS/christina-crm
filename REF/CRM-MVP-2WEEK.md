# CRM-MVP — 2-Week Sprint Plan

> Scoped to what's demo-able in 14 days. This is NOT the full product — it's the version that makes the client say "I want this, keep building."

## What the client sees at end of Week 2

A working web app they can log into and:
1. Add a referral by hand (their primary channel is word of mouth, not fax)
2. See it on a kanban pipeline (New → Eligibility → SOC → Admitted → Lost)
3. Move it through stages with one click
4. Look up and add organizations they refer from
5. Look up and add physician contacts at those orgs
6. See a dashboard with basic KPIs (referrals this week, conversion, pipeline count)
7. Switch between HH and Hospice tenants (they pay for both WellSky modules)
8. Feel that the UI is modern, fast, and NOT WellSky

## What we DON'T ship in 2 weeks

| Feature | Why deferred | When |
|---|---|---|
| AI fax parsing (Bedrock) | Client's referrals come by word of mouth, not fax | Week 3-4 |
| Stedi 270/271 eligibility | Needs Stedi API key + BAA signed | Week 3-4 |
| Denial risk scoring | Requires claims scrubber API ready | Week 4-6 |
| BD visit logging + GPS | Nice to have, not demo-critical | Week 4-5 |
| Full mobile PWA (offline) | Responsive is enough for demo | Week 5-6 |
| Reports + CSV/PDF export | Dashboard KPIs are enough for demo | Week 4-5 |
| QuickBooks integration | Requires QB app registration + BAA | Week 5-7 |
| Twilio SMS notifications | Email notifications first | Week 4-5 |
| WellSky CSV import | Client can seed data manually for demo | Week 6-8 |
| Full audit log UI | Audit writes happen; admin view comes later | Week 5 |

## Day-by-day sprint plan

### Days 1-2: Foundation
- [x] Monorepo scaffold (Next.js 15 + TS + Tailwind + shadcn) in existing claims platform repo
- [ ] Postgres `crm` schema DDL — tenants, users, referrals, organizations, contacts, audit_log
- [ ] RLS policies on all tables
- [ ] WorkOS auth integration (SSO login, role-based middleware)
- [ ] S3 bucket in **us-west-1** + KMS key
- [ ] Vercel deployment (dev environment)
- [ ] Seed data: 2 tenants (HH + Hospice), 1 admin user (Clay)

**Demo check:** Can Clay log in and see an empty dashboard? If yes, move on.

### Days 3-5: Referral core
- [ ] Referral create form (manual entry: patient initials, age, sex, dx, payer, orders, source org, referring physician)
- [ ] Referral list + detail view
- [ ] Pipeline kanban UI (5 columns, click to move, SLA color coding)
- [ ] Referral detail page (patient card, notes, document upload placeholder)
- [ ] Note creation on referrals (manual notes by user)

**Demo check:** Can Clay enter a referral and drag it through the pipeline? If yes, move on.

### Days 6-8: Organizations + contacts
- [ ] Organization CRUD (name, type, NPI, address, phone, fax)
- [ ] Organization list with basic scorecard (referral count, last contact)
- [ ] NPPES NPI auto-lookup on org create
- [ ] Contact CRUD (name, title, NPI, phone, email, linked to org)
- [ ] Contact list + search
- [ ] Link referral source to organization on create

**Demo check:** Can Clay add Mercy General, add Dr. Chen, and see the org scorecard update when a referral comes from there? If yes, move on.

### Days 9-10: Dashboard + tenant switcher
- [ ] Dashboard: 4 KPI tiles (new referrals, conversion %, pipeline count, active episodes)
- [ ] Dashboard: recent activity feed (last 10 referral events)
- [ ] Dashboard: top referral sources (bar chart or list)
- [ ] Tenant switcher dropdown in header (HH vs Hospice)
- [ ] Confirm RLS works — switching tenant shows different data

**Demo check:** Does the dashboard feel real? Can Clay switch between HH and Hospice and see different numbers? If yes, move on.

### Days 11-12: Polish + mobile responsive
- [ ] Mobile responsive layout (sidebar collapses, cards stack)
- [ ] Search bar (referrals, orgs, contacts — pg_trgm)
- [ ] Settings page shell (agency info, users list, HIPAA posture badges)
- [ ] Loading states, empty states, error boundaries
- [ ] Fix any layout/UX issues from days 3-10

### Days 13-14: Seed + demo prep
- [ ] Seed realistic data: 5-6 orgs, 10 contacts, 15-20 referrals across pipeline stages
- [ ] Both tenants populated (HH: larger data set, Hospice: smaller)
- [ ] Email notification: "new referral assigned" (basic SES, link only, no PHI)
- [ ] End-to-end walkthrough: login → dashboard → create referral → move through pipeline → org scorecard → switch tenant
- [ ] Record demo video or prep live demo

## Tech stack (MVP — same as full build, just less of it)

| Layer | Choice | MVP status |
|---|---|---|
| Frontend | Next.js 15 + shadcn + Tailwind | Full |
| Backend | Server Actions + API routes (Hono later) | Server Actions for MVP speed |
| Database | RDS Postgres (us-west-1) | Full schema, seed data |
| Auth | WorkOS | Full (SSO, roles) |
| Storage | S3 (us-west-1, KMS) | Bucket ready, upload UI placeholder |
| AI | Bedrock | NOT in MVP |
| Eligibility | Stedi | NOT in MVP |
| Notifications | SES | Basic email only |
| Observability | Datadog | Basic setup |
| Billing | Stripe | NOT in MVP |

## Definition of "demo-able"

The MVP demo succeeds if the client can:
1. Log in with their own email (WorkOS SSO)
2. See a dashboard that looks better than WellSky in the first 3 seconds
3. Enter a referral in under 60 seconds (vs WellSky's multi-screen flow)
4. See the pipeline and understand where every referral stands
5. Look up an organization and see how many referrals came from there
6. Switch between HH and Hospice and see different data
7. Open it on their phone and it works

If they say "I want this," we proceed to the full 10-week build.

## After the demo — Week 3-10 roadmap

| Week | Major features added |
|---|---|
| 3-4 | AI fax parsing (Bedrock), Stedi eligibility, denial risk hook |
| 4-5 | BD visit logging, mobile PWA (offline), reports + export |
| 5-6 | Twilio SMS, QuickBooks integration, full audit log UI |
| 6-8 | WellSky CSV import, dual-run, migration |
| 8-10 | Security review, DR drill, cutover, harden |
