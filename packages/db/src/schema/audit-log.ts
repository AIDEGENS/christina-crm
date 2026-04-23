/**
 * packages/db/src/schema/audit-log.ts
 *
 * Append-only. Every PHI interaction writes one row.
 * - No `updated_at` column — rows are immutable.
 * - RLS policies UPDATE/DELETE explicitly return false (0001_rls_policies.sql).
 */

import { sql } from 'drizzle-orm';
import {
  bigserial,
  inet,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { tenants } from './tenants.js';

export const auditLog = crm.table('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
