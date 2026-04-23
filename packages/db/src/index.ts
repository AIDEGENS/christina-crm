/**
 * packages/db/src/index.ts
 *
 * Public surface for @christina-crm/db.
 */

export * as schema from './schema/index.js';
export { createDb, type Db, type DbConfig } from './client.js';
export { withTenant } from './tenant-context.js';
