/**
 * packages/db/src/schema/_schema.ts
 *
 * Shared `crm` pgSchema handle. All table modules import `crm` from here so
 * every table lands in the same Postgres schema (`crm.*`).
 */

import { pgSchema } from 'drizzle-orm/pg-core';

export const crm = pgSchema('crm');
