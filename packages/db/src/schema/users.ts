/**
 * packages/db/src/schema/users.ts
 *
 * Local shadow of WorkOS users. `workos_user_id` is the canonical identity;
 * this row carries app-level role + tenant linkage for RLS.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { tenants } from './tenants.js';

export const users = crm.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    workosUserId: text('workos_user_id').notNull().unique(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    role: text('role').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    roleChk: check(
      'users_role_chk',
      sql`${t.role} IN ('admin', 'intake', 'bd_rep', 'viewer')`,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
