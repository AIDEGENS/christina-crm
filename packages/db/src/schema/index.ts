/**
 * packages/db/src/schema/index.ts
 *
 * Barrel export for all `crm.*` tables. `client.ts` passes the full export
 * object to `drizzle()` as the schema bundle.
 */

export { crm } from './_schema.js';
export * from './tenants.js';
export * from './users.js';
export * from './organizations.js';
export * from './contacts.js';
export * from './referrals.js';
export * from './referral-notes.js';
export * from './referral-documents.js';
export * from './bd-visits.js';
export * from './audit-log.js';
