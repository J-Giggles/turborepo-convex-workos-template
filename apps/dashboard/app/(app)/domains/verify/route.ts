import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { verifyDomain, vercelEnabled } from '../../../../lib/vercel';
import { NextResponse } from 'next/server';

export async function POST() {
  if (!vercelEnabled()) {
    return NextResponse.json({ disabled: true }, { status: 200 });
  }

  // NOTE: this endpoint is unauthenticated for cron access. In production, gate
  // it with a shared secret in a header or run the polling loop directly inside
  // the Convex cron's internalAction (no HTTP hop). The template uses a route
  // handler so the cron can run on Vercel's free tier.
  const orgs = await fetchQuery(api.organizations.list, {});
  const results: Array<{ host: string; verified: boolean }> = [];

  for (const org of orgs) {
    const domains = await fetchQuery(api.domains.listByOrg, { orgId: org._id });
    for (const d of domains) {
      if (d.verified) continue;
      try {
        const r = await verifyDomain(d.host);
        if (!r.disabled && r.data.verified) {
          await fetchMutation(api.domains.setVerified, { id: d._id, verified: true });
          results.push({ host: d.host, verified: true });
        } else {
          results.push({ host: d.host, verified: false });
        }
      } catch (err) {
        results.push({ host: d.host, verified: false });
        console.error(`verify ${d.host} failed:`, err);
      }
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
