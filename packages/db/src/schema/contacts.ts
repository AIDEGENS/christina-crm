import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm, preferredContact } from "./_shared";
import { organizations } from "./organizations";
import { tenants } from "./tenants";

export const contacts = crm.table("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  role: text("role"),
  npi: text("npi"),
  phone: text("phone"),
  email: text("email"),
  preferredContact: preferredContact("preferred_contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
