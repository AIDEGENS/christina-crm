/**
 * apps/api/src/bootstrap.ts
 *
 * Phase 0.6 (AWS-only migration) — boot-time secret loader.
 *
 * Runs BEFORE the tracer and server start. In production it pulls every
 * parameter under `/medical-crm/${APP_ENV}/` from SSM (decrypted) and merges
 * the values into `process.env` so every downstream module (tracer,
 * DATABASE_URL, WorkOS, etc.) reads them via the standard env-var path.
 *
 * In non-production (`NODE_ENV !== 'production'`), `loadSecrets` returns
 * an empty object and we fall through to the existing `.env` file on disk.
 *
 * `APP_ENV` is injected by the ECS task definition (dev / stg / prd). If
 * missing we default to `dev` so a misconfigured container crashes loudly
 * later (missing DB creds) rather than silently pulling prod values.
 */

import { loadSecrets, type SsmEnv } from '@christina-crm/config/secrets';

function pickEnv(): SsmEnv {
  const raw = (process.env['APP_ENV'] ?? 'dev').toLowerCase();
  if (raw === 'dev' || raw === 'stg' || raw === 'prd') return raw;
  return 'dev';
}

export async function bootstrapSecrets(): Promise<void> {
  const env = pickEnv();
  const params = await loadSecrets(env);
  for (const [k, v] of Object.entries(params)) {
    // Never overwrite something the container already has set — this lets
    // an operator pin a value via ECS task env for emergency overrides
    // without needing to rotate the SSM parameter.
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}
