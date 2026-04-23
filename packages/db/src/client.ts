/**
 * packages/db/src/client.ts
 *
 * Drizzle client. Caller owns the connection string; we do NOT read
 * DATABASE_URL from process.env inside the module so unit tests can inject.
 *
 * Pool sizing: `max` defaults to 10 per Node process. Tune per workload in
 * the API gateway (Phase 1). Connections should use a role that inherits
 * `crm_app` (see migrations/0004_crm_app_role.sql) — NOT a BYPASSRLS role.
 *
 * TLS:
 *   - In production (NODE_ENV === 'production') we default to certificate
 *     verification (`rejectUnauthorized: true`). Encryption without
 *     verification does not protect against MITM on the RDS path.
 *   - In development we default to 'require' (encryption, no verification)
 *     so local docker-compose setups using self-signed certs still work.
 *   - Callers can always override via `config.ssl`.
 *
 * TODO(phase-0.2-bootstrap): once the RDS CA bundle path convention is
 * shipped, wire the CA here so prod connections verify against the
 * Amazon-issued chain rather than the system trust store.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Db = ReturnType<typeof createDb>;

export type SslOption =
  | 'require'
  | 'prefer'
  | boolean
  | { rejectUnauthorized: boolean; ca?: string };

export interface DbConfig {
  connectionString: string;
  max?: number;
  ssl?: SslOption;
}

function resolveSsl(override: SslOption | undefined): SslOption {
  if (override !== undefined) {
    return override;
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // Prod: verify cert. Callers MUST supply a CA bundle via the override
    // once the bootstrap step ships a canonical bundle path.
    return { rejectUnauthorized: true };
  }
  // Dev: encrypt but don't verify — local docker-compose often uses a
  // self-signed cert.
  return 'require';
}

export function createDb(config: DbConfig) {
  const client = postgres(config.connectionString, {
    max: config.max ?? 10,
    ssl: resolveSsl(config.ssl),
    // Drizzle + postgres-js both support prepared statements; leave default on.
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export { schema };
