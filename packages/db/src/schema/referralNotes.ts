import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm, noteType } from "./_shared";
import { referrals } from "./referrals";
import { tenants } from "./tenants";
import { users } from "./users";

export const referralNotes = crm.table("referral_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  referralId: uuid("referral_id")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  noteType: noteType("note_type").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ReferralNote = typeof referralNotes.$inferSelect;
export type NewReferralNote = typeof referralNotes.$inferInsert;
