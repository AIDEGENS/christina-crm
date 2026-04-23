/**
 * packages/db/src/schema/contacts.ts
 *
 * People at organizations: physicians, case managers, discharge planners.
 */

import { sql } from 'drizzle-orm';
import { check, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { organizations } from './organizations.js';
import { tenants } from './tenants.js';

export const contacts = crm.table(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    title: text('title'),
    role: text('role'),
    npi: text('npi'),
    phone: text('phone'),
    email: text('email'),
    preferredContact: text('preferred_contact'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    preferredContactChk: check(
      'contacts_preferred_contact_chk',
      sql`${t.preferredContact} IS NULL OR ${t.preferredContact} IN ('phone', 'email', 'fax', 'in_person')`,
    ),
  }),
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
