import { date, doublePrecision, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm } from "./_shared";
import { organizations } from "./organizations";
import { tenants } from "./tenants";
import { users } from "./users";

// contacts_met stores an array of contact UUIDs; Postgres doesn't enforce FK
// constraints on array elements, so referential integrity is checked in app code.
export const bdVisits = crm.table("bd_visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  visitDate: date("visit_date").notNull(),
  contactsMet: uuid("contacts_met").array(),
  notes: text("notes"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BdVisit = typeof bdVisits.$inferSelect;
export type NewBdVisit = typeof bdVisits.$inferInsert;
