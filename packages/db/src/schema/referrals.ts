/**
 * packages/db/src/schema/referrals.ts
 *
 * Core entity. One row per patient referral.
 *
 * PHI columns (text type, app-layer pgcrypto in Phase 1):
 *   - patient_dob, patient_mrn, patient_address, patient_member_id,
 *     patient_ssn_last4
 *
 * `county` column exists per REF/.omc/verifier-spec/crm-migration-add-county.sql
 * so the Verifier (VR-009) never needs a cross-schema ALTER.
 */

import { sql } from 'drizzle-orm';
import {
  check,
  date,
  doublePrecision,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { crm } from './_schema.js';
import { contacts } from './contacts.js';
import { organizations } from './organizations.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const referrals = crm.table(
  'referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    refNumber: text('ref_number').notNull(),
    status: text('status').notNull().default('new'),
    sourceOrgId: uuid('source_org_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    sourceContactId: uuid('source_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    intakeChannel: text('intake_channel'),

    // Display-safe identifiers.
    patientInitials: text('patient_initials'),
    patientAge: integer('patient_age'),
    patientSex: text('patient_sex'),

    // TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patientDob: text('patient_dob'),
    // TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patientMrn: text('patient_mrn'),
    // TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patientAddress: text('patient_address'),
    // TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patientMemberId: text('patient_member_id'),
    // TODO(phase-1): encrypt with pgcrypto at app layer (PHI).
    patientSsnLast4: text('patient_ssn_last4'),

    primaryDxCode: text('primary_dx_code'),
    primaryDxDesc: text('primary_dx_desc'),
    secondaryDx: jsonb('secondary_dx').notNull().default(sql`'[]'::jsonb`),

    payerType: text('payer_type'),
    payerName: text('payer_name'),

    // Service county — required by Verifier VR-009 at routing time.
    county: text('county'),

    orders: text('orders').array(),
    dischargeDate: date('discharge_date'),

    eligibilityStatus: text('eligibility_status').notNull().default('not_checked'),
    eligibilityCheckedAt: timestamp('eligibility_checked_at', {
      withTimezone: true,
    }),
    eligibilityStediTxn: text('eligibility_stedi_txn'),

    denialRiskScore: integer('denial_risk_score'),

    socDate: date('soc_date'),
    socNurseId: uuid('soc_nurse_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    admittedAt: timestamp('admitted_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    assignedTo: uuid('assigned_to').references(() => users.id, {
      onDelete: 'set null',
    }),
    aiConfidence: doublePrecision('ai_confidence'),
    rawDocumentS3Key: text('raw_document_s3_key'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusChk: check(
      'referrals_status_chk',
      sql`${t.status} IN ('new', 'eligibility', 'soc_scheduled', 'admitted', 'lost', 'denied')`,
    ),
    intakeChannelChk: check(
      'referrals_intake_channel_chk',
      sql`${t.intakeChannel} IS NULL OR ${t.intakeChannel} IN ('fax', 'email', 'e_referral', 'phone', 'walk_in')`,
    ),
    patientSexChk: check(
      'referrals_patient_sex_chk',
      sql`${t.patientSex} IS NULL OR ${t.patientSex} IN ('m', 'f', 'other')`,
    ),
    payerTypeChk: check(
      'referrals_payer_type_chk',
      sql`${t.payerType} IS NULL OR ${t.payerType} IN ('medicare_a', 'medicare_b', 'medi_cal', 'ma_plan', 'private', 'other')`,
    ),
    eligibilityStatusChk: check(
      'referrals_eligibility_status_chk',
      sql`${t.eligibilityStatus} IN ('pending', 'verified', 'failed', 'not_checked')`,
    ),
    countyChk: check(
      'referrals_county_chk',
      sql`${t.county} IS NULL OR ${t.county} IN ('los_angeles', 'san_bernardino', 'riverside', 'orange', 'san_diego')`,
    ),
  }),
);

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
