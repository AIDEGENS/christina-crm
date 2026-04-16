import { bigint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm } from "./_shared";
import { referrals } from "./referrals";
import { tenants } from "./tenants";
import { users } from "./users";

export const referralDocuments = crm.table("referral_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  referralId: uuid("referral_id")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  s3Key: text("s3_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ReferralDocument = typeof referralDocuments.$inferSelect;
export type NewReferralDocument = typeof referralDocuments.$inferInsert;
