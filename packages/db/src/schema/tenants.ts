import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm } from "./_shared";

export const tenants = crm.table("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  npi: text("npi"),
  ein: text("ein"),
  medicarePtan: text("medicare_ptan"),
  macJurisdiction: text("mac_jurisdiction"),
  mediCalProviderId: text("medi_cal_provider_id"),
  serviceArea: text("service_area").array(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
