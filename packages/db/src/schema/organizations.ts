import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { crm, orgType } from "./_shared";
import { tenants } from "./tenants";
import { users } from "./users";

export type OrgAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
};

export const organizations = crm.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: orgType("type").notNull(),
  npi: text("npi"),
  address: jsonb("address").$type<OrgAddress>(),
  phone: text("phone"),
  fax: text("fax"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
