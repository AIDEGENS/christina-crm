/**
 * apps/api/src/routes/v1/me.ts
 *
 * Phase 0.4 — GET /v1/me returns the current session's user + tenant + role.
 *
 * Assumes `requireAuth` and `requireTenantContext` have already run on the
 * parent `/v1/*` group, so `c.var` is populated.
 */

import { Hono } from 'hono';
import type { AuthedEnv } from '../../middleware/require-auth.js';

const route = new Hono<AuthedEnv>();

route.get('/', (c) => {
  const user = c.get('user');
  const tenant_id = c.get('tenant_id');
  const role = c.get('role');

  return c.json({
    user,
    tenant_id,
    role,
  });
});

export default route;
