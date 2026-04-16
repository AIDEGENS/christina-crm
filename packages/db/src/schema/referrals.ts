import {
  date,
  doublePrecision,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  crm,
  eligibilityStatus,
  intakeChannel,
  patientSex,
  payerType,
  referralStatus,
} from "./_shared";
import { contacts } from "./contacts";
import { organizations } from "./organizations";
import { tenants } from "./tenants";
import { users } from "./users";

export type PatientAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export type SecondaryDx = { code: string; desc: string };

export const referrals = crm.table("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  refNumber: text("ref_number").notNull(),
  status: referralStatus("status").notNull().default("new"),
  sourceOrgId: uuid("source_org_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  sourceContactId: uuid("source_contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  intakeChannel: intakeChannel("intake_channel"),

  // Display-safe identifiers (not PHI)
  patientInitials: text("patient_initials"),
  patientAge: integer("patient_age"),
  patientSex: patientSex("patient_sex"),

  // PHI — encrypt at app layer with pgcrypto (see step 0.8+)
  patientDob: date("patient_dob"),
  patientMrn: text("patient_mrn"),
  patientAddress: jsonb("patient_address").$type<PatientAddress>(),

  primaryDxCode: text("primary_dx_code"),
  primaryDxDesc: text("primary_dx_desc"),
  secondaryDx: jsonb("secondary_dx").$type<SecondaryDx[]>(),

  payerType: payerType("payer_type"),
  payerName: text("payer_name"),
  payerMemberId: text("payer_member_id"),

  orders: text("orders").array(),
  dischargeDate: date("discharge_date"),

  eligibilityStatus: eligibilityStatus("eligibility_status").default("not_checked"),
  eligibilityCheckedAt: timestamp("eligibility_checked_at", { withTimezone: true }),
  eligibilityStediTxn: text("eligibility_stedi_txn"),
  denialRiskScore: integer("denial_risk_score"),

  socDate: date("soc_date"),
  socNurseId: uuid("soc_nurse_id").references(() => users.id, { onDelete: "set null" }),
  admittedAt: timestamp("admitted_at", { withTimezone: true }),
  lostReason: text("lost_reason"),

  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),

  aiConfidence: doublePrecision("ai_confidence"),
  rawDocumentS3Key: text("raw_document_s3_key"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
