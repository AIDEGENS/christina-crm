/**
 * packages/db/src/schema/bd-visits.ts
 *
 * BD rep visit logs at referring organizations. `contacts_met` is an array of
 * contact UUIDs (loose reference — no FK array enforcement in Postgres).
 */

import {
  date,
  doublePrecision,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { organizations } from './organizations.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const bdVisits = crm.table('bd_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  visitDate: date('visit_date').notNull(),
  contactsMet: uuid('contacts_met').array(),
  notes: text('notes'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BdVisit = typeof bdVisits.$inferSelect;
export type NewBdVisit = typeof bdVisits.$inferInsert;
