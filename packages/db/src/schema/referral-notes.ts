/**
 * packages/db/src/schema/referral-notes.ts
 *
 * Timeline notes on a referral. author_user_id NULL = system/AI.
 */

import { sql } from 'drizzle-orm';
import { check, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { referrals } from './referrals.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const referralNotes = crm.table(
  'referral_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => referrals.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    noteType: text('note_type').notNull().default('manual'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    noteTypeChk: check(
      'referral_notes_note_type_chk',
      sql`${t.noteType} IN ('manual', 'auto_extract', 'auto_eligibility', 'system')`,
    ),
  }),
);

export type ReferralNote = typeof referralNotes.$inferSelect;
export type NewReferralNote = typeof referralNotes.$inferInsert;
