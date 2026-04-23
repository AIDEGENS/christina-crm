/**
 * packages/db/src/schema/referral-documents.ts
 *
 * S3-referenced documents attached to a referral. No inline bytes.
 */

import { bigint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { referrals } from './referrals.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const referralDocuments = crm.table('referral_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  referralId: uuid('referral_id')
    .notNull()
    .references(() => referrals.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  s3Key: text('s3_key').notNull(),
  contentType: text('content_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: uuid('uploaded_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReferralDocument = typeof referralDocuments.$inferSelect;
export type NewReferralDocument = typeof referralDocuments.$inferInsert;
