import { pgSchema } from "drizzle-orm/pg-core";

export const crm = pgSchema("crm");

export const userRole = crm.enum("user_role", ["admin", "intake", "bd_rep", "viewer"]);

export const orgType = crm.enum("org_type", [
  "acute_care",
  "snf",
  "physician",
  "hospice_facility",
  "other",
]);

export const preferredContact = crm.enum("preferred_contact", [
  "phone",
  "email",
  "fax",
  "in_person",
]);

export const referralStatus = crm.enum("referral_status", [
  "new",
  "eligibility",
  "soc_scheduled",
  "admitted",
  "lost",
  "denied",
]);

export const intakeChannel = crm.enum("intake_channel", [
  "fax",
  "email",
  "e_referral",
  "phone",
  "walk_in",
]);

export const patientSex = crm.enum("patient_sex", ["m", "f", "other"]);

export const payerType = crm.enum("payer_type", [
  "medicare_a",
  "medicare_b",
  "medi_cal",
  "ma_plan",
  "private",
  "other",
]);

export const eligibilityStatus = crm.enum("eligibility_status", [
  "pending",
  "verified",
  "failed",
  "not_checked",
]);

export const noteType = crm.enum("note_type", [
  "manual",
  "auto_extract",
  "auto_eligibility",
  "system",
]);
