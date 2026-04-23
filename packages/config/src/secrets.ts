/**
 * packages/config/src/secrets.ts
 *
 * Phase 0.6 (AWS-only migration) — SSM Parameter Store loader.
 *
 * Replaces Doppler as the production secret source. Local dev continues to
 * read `.env` via Next.js / `dotenv` style — this loader is a no-op when
 * `NODE_ENV !== 'production'`.
 *
 * HIPAA posture: all SSM parameters are SecureString, KMS-encrypted with
 * `alias/medical-crm`. IAM role on the ECS task grants
 * `ssm:GetParametersByPath` + `kms:Decrypt` scoped to the
 * `/medical-crm/${env}/*` prefix. No secret ever lands in an env-var at
 * deploy time — the container fetches at boot over the VPC endpoint.
 *
 * Naming convention: `/medical-crm/${env}/${KEY}` where `env` is one of
 * `dev` | `stg` | `prd` and `KEY` is the SHOUTY_SNAKE_CASE name from
 * `.env.example` (e.g. `DATABASE_URL`, `WORKOS_API_KEY`).
 *
 * Call `loadSecrets(env)` early from your app bootstrap (before tracer
 * init), `await` it, then merge the result into `process.env`. Downstream
 * modules read `process.env.FOO` as they always have — zero SDK coupling
 * beyond this file.
 */

import {
  SSMClient,
  GetParametersByPathCommand,
  type GetParametersByPathCommandOutput,
} from '@aws-sdk/client-ssm';

export type SsmEnv = 'dev' | 'stg' | 'prd';

// Process-lifetime cache. Parameters rotate slowly; fetching once per
// container boot is fine and avoids round-tripping on every request.
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

/**
 * Returns a flat map of SSM parameters under `/medical-crm/${env}/`,
 * with the path prefix stripped so callers see bare variable names.
 *
 * In non-production environments this returns an empty object — local
 * dev continues to use `.env` files via Next.js / dotenv and the normal
 * `process.env` read-through.
 */
export async function loadSecrets(env: SsmEnv): Promise<Record<string, string>> {
  if (process.env['NODE_ENV'] !== 'production') {
    return {};
  }

  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const region = process.env['AWS_REGION'] ?? 'us-west-1';
    const client = new SSMClient({ region });
    const prefix = `/medical-crm/${env}/`;

    const collected: Record<string, string> = {};
    let nextToken: string | undefined = undefined;

    // Paginate. GetParametersByPath returns up to 10 parameters per page,
    // so for a ~30-key project we'll loop 3 times.
    do {
      const resp: GetParametersByPathCommandOutput = await client.send(
        new GetParametersByPathCommand({
          Path: prefix,
          Recursive: true,
          WithDecryption: true,
          NextToken: nextToken,
        }),
      );

      for (const p of resp.Parameters ?? []) {
        if (!p.Name || p.Value === undefined) continue;
        // `/medical-crm/prd/DATABASE_URL` → `DATABASE_URL`
        const bare = p.Name.startsWith(prefix) ? p.Name.slice(prefix.length) : p.Name;
        collected[bare] = p.Value;
      }

      nextToken = resp.NextToken;
    } while (nextToken);

    cache = collected;
    return collected;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Test / emergency helper — drop the cached secrets so the next call
 * refetches. Not called in normal app flow.
 */
export function clearSecretsCache(): void {
  cache = null;
  inflight = null;
}
