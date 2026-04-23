import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import './globals.css';

export const metadata: Metadata = {
  title: 'Christina CRM',
  description: 'Referral management platform — Phase 0.1 scaffold',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // H-3 (2026-04-22): pull per-request nonce from middleware. Next 15 makes
  // `headers()` async. Passing `nonce` into descendant <Script> tags (when
  // added) keeps them compliant with the enforce-mode CSP.
  const hdrs = await headers();
  const nonce = hdrs.get('x-nonce') ?? undefined;

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased" data-nonce={nonce}>
        <AuthKitProvider>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
