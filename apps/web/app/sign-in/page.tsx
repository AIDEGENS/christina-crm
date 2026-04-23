/**
 * apps/web/app/sign-in/page.tsx
 *
 * Phase 0.4 — thin redirector to WorkOS hosted sign-in.
 *
 * We don't render a custom form. AuthKit returns a URL to WorkOS's hosted
 * page (email + password, SSO buttons, magic-link) and we send the user
 * there immediately. Keeps us out of the credential-handling blast radius.
 */

import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

export default async function SignInPage(): Promise<never> {
  const url = await getSignInUrl();
  redirect(url);
}
