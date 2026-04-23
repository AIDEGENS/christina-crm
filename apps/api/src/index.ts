// MUST be the first import — X-Ray patches `https` / `http` / `pg` at load.
// Anything imported before the tracer holds un-patched references and will
// not appear in traces.
import './tracer.js';
import { bootstrapSecrets } from './bootstrap.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createLogger } from '@christina-crm/observability';
import { requireAuth, type AuthedEnv } from './middleware/require-auth.js';
import { requireOrigin } from './middleware/require-origin.js';
import { requireTenantContext } from './middleware/require-tenant-context.js';
import meRoute from './routes/v1/me.js';
import workosScimRoute from './routes/webhooks/workos-scim.js';

const logger = createLogger({ service: 'crm-api' });

const app = new Hono();

// Unprotected — liveness probe.
app.get('/health', (c) => {
  return c.json({ ok: true });
});

// Unprotected — WorkOS directory sync webhook. Auth is via signed body,
// not session cookie, so it cannot sit behind requireAuth.
app.route('/webhooks/workos-scim', workosScimRoute);

// Everything under /v1/* requires a valid session + tenant context.
// Order matters: requireOrigin runs FIRST so CSRF attempts never reach the
// cookie decode path. Then requireAuth (cookie -> user). Then tenant resolution.
const v1 = new Hono<AuthedEnv>();
v1.use('*', requireOrigin);
v1.use('*', requireAuth);
v1.use('*', requireTenantContext);

v1.route('/me', meRoute);

// Phase 1.1 will implement referral CRUD.
v1.get('/referrals', (c) => {
  return c.json({ error: 'Not implemented — Phase 1.1' }, 501);
});

v1.post('/referrals', (c) => {
  return c.json({ error: 'Not implemented — Phase 1.1' }, 501);
});

app.route('/v1', v1);

const port = Number(process.env.PORT ?? 3001);

// Boot sequence: await SSM secrets → start server. In non-production
// `bootstrapSecrets` is a no-op returning immediately, so dev/test startup
// stays sub-millisecond. In production we block on one
// GetParametersByPath round-trip (~50 ms typical) before accepting traffic.
void bootstrapSecrets().then(() => {
  serve({ fetch: app.fetch, port }, () => {
    logger.info({ port }, 'API running');
  });
});

export default app;
