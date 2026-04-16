import { bigserial, inet, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm } from "./_shared";

// Append-only. RLS policies in 0001_rls_policies.sql block UPDATE and DELETE.
// tenant_id / user_id are NOT declared as foreign keys on purpose — we want
// audit rows to survive cascade deletes of their source tenant/user.
export const auditLog = crm.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
