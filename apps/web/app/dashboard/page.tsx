/**
 * apps/web/app/dashboard/page.tsx
 *
 * Phase 0.4 — post-auth landing page placeholder.
 *
 * Confirms the full auth loop works: WorkOS session cookie is present,
 * `withAuth()` resolves the user, and `resolveTenantFromUser()` returns a
 * tenant mapping. Real dashboard lands in Phase 3.1.
 */

import React from 'react';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { resolveTenantFromUser, type AuthenticatedUser } from '@christina-crm/auth';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  // withAuth({ ensureSignedIn: true }) redirects to /sign-in if missing.
  const { user } = await withAuth({ ensureSignedIn: true });

  const authedUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    ...(user.firstName ? { first_name: user.firstName } : {}),
    ...(user.lastName ? { last_name: user.lastName } : {}),
  };

  const { tenant_id, role } = await resolveTenantFromUser(authedUser);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-4 text-gray-700">
          Hello <span className="font-mono">{user.email}</span> — tenant{' '}
          <span className="font-mono">{tenant_id}</span>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Role: <span className="font-mono">{role}</span>
        </p>
        <p className="mt-8 text-xs font-mono text-gray-400">
          Phase 0.4 placeholder — real dashboard ships in Phase 3.1.
        </p>
      </div>
    </main>
  );
}
