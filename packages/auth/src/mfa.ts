/**
 * packages/auth/src/mfa.ts
 *
 * Phase 0.4 — MFA enforcement SEAM (post-MVP).
 *
 * WorkOS supports per-organization MFA policy. We want the option to enforce
 * MFA for certain tenants (BAA-signed home health agencies, PHI-adjacent
 * hospice accounts) without forcing it on everyone during pilot.
 *
 * TODO(post-mvp): wire this to WorkOS organization settings API and call it
 * from `middleware.ts` after withAuth() succeeds. If the tenant requires MFA
 * and the session doesn't show an mfa claim, redirect to /auth/mfa-challenge.
 */

import type { TenantId } from './types';
import { NotImplementedError } from './errors';

export async function enforceMfaForTenant(_tenant_id: TenantId): Promise<void> {
  // TODO(post-mvp): look up tenant.mfa_required, check session.user.amr for
  // 'mfa' claim, redirect to challenge if missing.
  throw new NotImplementedError('enforceMfaForTenant (post-MVP)');
}
