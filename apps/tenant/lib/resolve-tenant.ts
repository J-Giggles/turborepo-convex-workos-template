import 'server-only';
import { fetchQuery } from 'convex/nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Doc } from '@repo/backend/_generated/dataModel';
import { env } from '../env';

export type ResolvedTenant =
  | { kind: 'org'; org: Doc<'organizations'> }
  | { kind: 'apex' }
  | { kind: 'unknown' };

/**
 * Resolve a request Host header to a tenant. Cached by host with tag
 * `tenant:{host}` so the dashboard's domain CRUD can invalidate it via
 * `revalidateTag('tenant:{host}')` immediately after Vercel verification.
 */
export async function resolveTenant(host: string): Promise<ResolvedTenant> {
  'use cache';
  cacheTag(`tenant:${host}`);
  cacheLife('hours');

  const lower = host.toLowerCase();
  const platformRoot = env.NEXT_PUBLIC_PLATFORM_ROOT.toLowerCase();

  // Strip port for apex/subdomain comparison; Convex queries see hostname only.
  const hostNoPort = lower.split(':')[0] ?? '';
  const platformRootNoPort = platformRoot.split(':')[0] ?? '';

  // Exact apex match → marketing redirect target
  if (hostNoPort === platformRootNoPort) {
    return { kind: 'apex' };
  }

  const org = await fetchQuery(api.tenant.getByHost, {
    host: hostNoPort,
    platformRoot: platformRootNoPort,
  });
  return org ? { kind: 'org', org } : { kind: 'unknown' };
}
