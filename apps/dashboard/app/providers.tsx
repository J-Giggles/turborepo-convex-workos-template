'use client';

import type { ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { env } from '../env';

const client = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

client.setAuth(async () => {
  // Returns the AuthKit access token, or null if unauthenticated.
  // The token route at /api/auth/token reads the sealed AuthKit cookie
  // server-side. Convex re-invokes this fetcher whenever it needs auth.
  try {
    const res = await fetch('/api/auth/token', { credentials: 'include' });
    if (!res.ok) return null;
    const { token } = (await res.json()) as { token: string | null };
    return token;
  } catch {
    return null;
  }
});

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
