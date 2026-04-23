/**
 * packages/db/src/schema/tenants.ts
 *
 * Multi-tenant root. One row per agency (HH, Hospice, etc.).
 * Mirrors REF/CRM-03-DATA-MODEL.md §crm.tenants.
 *
 * Security:
 *   - `ein` is PHI-adjacent; app layer encrypts with pgcrypto before insert
 *     (Phase 1 — not implemented here).
 *   - RLS policy on this table restricts each connection to ITS own tenant row
 *     (see migrations/0001_rls_policies.sql: tenant_self_select).
 */

import { sql } from 'drizzle-orm';
import { check, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';

export const tenants = crm.table(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    npi: text('npi'),
    // TODO(phase-1): encrypt with pgcrypto at app layer.
    ein: text('ein'),
    medicarePtan: text('medicare_ptan'),
    macJurisdiction: text('mac_jurisdiction'),
    mediCalProviderId: text('medi_cal_provider_id'),
    serviceArea: text('service_area').array(),
    stripeCustomerId: text('stripe_customer_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    macJurisdictionChk: check(
      'tenants_mac_jurisdiction_chk',
      sql`${t.macJurisdiction} IS NULL OR ${t.macJurisdiction} IN ('noridian_je', 'noridian_jf', 'ngs')`,
    ),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
