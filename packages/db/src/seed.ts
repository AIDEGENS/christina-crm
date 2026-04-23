/**
 * packages/db/src/seed.ts
 *
 * Seeds the 2 founding tenants for Meridian (HH + Hospice).
 * Run with: pnpm tsx packages/db/src/seed.ts
 *
 * Constraints:
 *   - Tenants ONLY. No referrals, contacts, or PHI.
 *   - DATABASE_URL must point at a db where the 0000 migration has been
 *     applied. Connection should be made as a BYPASSRLS admin role (not
 *     `crm_app`) because there is no tenant GUC set at seed time.
 */

import { createDb } from './client.js';
import { tenants } from './schema/tenants.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('seed: DATABASE_URL is required');
  }

  const { db, client } = createDb({ connectionString: url });

  try {
    const inserted = await db
      .insert(tenants)
      .values([
        {
          name: 'Meridian Home Health',
          // placeholder — real NPI populated by tenant onboarding;
          // Luhn-valid NPI NEVER committed.
          npi: '0000000000',
          macJurisdiction: 'noridian_je',
          serviceArea: ['Sacramento', 'Placer', 'El Dorado'],
        },
        {
          name: 'Meridian Hospice',
          // placeholder — real NPI populated by tenant onboarding;
          // Luhn-valid NPI NEVER committed.
          npi: '0000000001',
          macJurisdiction: 'noridian_je',
          serviceArea: ['Sacramento', 'Placer'],
        },
      ])
      .returning({ id: tenants.id, name: tenants.name });

    for (const row of inserted) {
      // eslint-disable-next-line no-console
      console.log(`seeded tenant: ${row.name} -> ${row.id}`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
