/**
 * packages/db/src/schema/organizations.ts
 *
 * Referring entities: hospitals, SNFs, physician practices.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const organizations = crm.table(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    npi: text('npi'),
    address: jsonb('address'),
    phone: text('phone'),
    fax: text('fax'),
    ownerUserId: uuid('owner_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    typeChk: check(
      'organizations_type_chk',
      sql`${t.type} IN ('acute_care', 'snf', 'physician', 'hospice_facility', 'other')`,
    ),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
