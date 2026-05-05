'use server';

import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath } from 'next/cache';
import { addDomain, verifyDomain, removeDomain, vercelEnabled } from '../../../lib/vercel';

export async function createDomain(formData: FormData) {
  const orgId = formData.get('orgId') as Id<'organizations'>;
  const host = String(formData.get('host') ?? '').trim().toLowerCase();
  if (!host) throw new Error('Host is required.');

  const vercelResult = vercelEnabled() ? await addDomain(host) : { disabled: true as const };
  const configId =
    !vercelResult.disabled && 'data' in vercelResult ? vercelResult.data.name : null;

  await fetchMutation(api.domains.create, {
    orgId,
    host,
    isPrimary: false,
    vercelConfigId: configId,
  });
  revalidatePath('/domains');
}

export async function verifyDomainAction(domainId: Id<'domains'>, host: string) {
  if (!vercelEnabled()) {
    throw new Error('Vercel API not configured. Set VERCEL_API_TOKEN to enable verification.');
  }
  const result = await verifyDomain(host);
  if (!result.disabled && result.data.verified) {
    await fetchMutation(api.domains.setVerified, { id: domainId, verified: true });
  }
  revalidatePath('/domains');
}

export async function removeDomainAction(domainId: Id<'domains'>, host: string) {
  if (vercelEnabled()) {
    try {
      await removeDomain(host);
    } catch {
      // Vercel may have already removed it; continue with local delete.
    }
  }
  await fetchMutation(api.domains.remove, { id: domainId });
  revalidatePath('/domains');
}
