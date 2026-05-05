import 'server-only';
import { withAuth } from '@repo/auth/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Doc } from '@repo/backend/_generated/dataModel';
import { redirect } from 'next/navigation';

export type ActiveOrg = {
  user: { id: string; email: string; name: string | null };
  org: Doc<'organizations'>;
};

/**
 * Resolves the user + their active organization. Use in `(app)/*` server
 * components — `proxy.ts` already gated the route, so unauthenticated requests
 * never reach this. Failures here are about an unsynced organization or a
 * missing JWT claim.
 */
export async function readActiveOrg(): Promise<ActiveOrg> {
  const session = await withAuth({ ensureSignedIn: true });

  if (!session.organizationId) {
    // User has no organization. AuthKit's create-org flow handles this; we
    // bounce them there.
    redirect('/sign-in?reason=no-org');
  }

  const org = await fetchQuery(api.organizations.getByWorkosId, {
    workosOrgId: session.organizationId,
  });

  if (!org) {
    // Org exists in WorkOS but the webhook hasn't synced yet. Surface a
    // human-readable error rather than a 500. Real apps might retry with a
    // brief delay; the template just throws.
    throw new Error(
      `Organization ${session.organizationId} is not yet synced from WorkOS. ` +
        'Try again in a few seconds.',
    );
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.firstName
        ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ''}`
        : null,
    },
    org,
  };
}
