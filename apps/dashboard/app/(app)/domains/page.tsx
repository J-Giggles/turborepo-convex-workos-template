import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { readActiveOrg } from '../../../lib/active-org';
import { DomainRow } from '../../../components/domain-row';
import { vercelEnabled } from '../../../lib/vercel';
import { createDomain, removeDomainAction, verifyDomainAction } from './actions';

export default async function DomainsPage() {
  const { org } = await readActiveOrg();
  const domains = await fetchQuery(api.domains.listByOrg, { orgId: org._id });
  const enabled = vercelEnabled();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
      </div>

      {!enabled && (
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
          <strong className="text-[var(--color-foreground)]">Vercel integration disabled.</strong>{' '}
          Set <code>VERCEL_API_TOKEN</code>, <code>VERCEL_TEAM_ID</code>, and{' '}
          <code>VERCEL_PROJECT_ID_TENANT</code> in <code>apps/dashboard/.env.local</code> to add and
          verify custom domains.
        </div>
      )}

      <form action={createDomain} className="flex items-end gap-2 rounded-md border p-4">
        <input type="hidden" name="orgId" value={org._id} />
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="host">Add a custom domain</Label>
          <Input
            id="host"
            name="host"
            type="text"
            required
            placeholder="app.acmecorp.com"
            disabled={!enabled}
          />
        </div>
        <Button type="submit" disabled={!enabled}>
          Add
        </Button>
      </form>

      {domains.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-[var(--color-muted-foreground)]">
          No custom domains yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--color-muted)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Host</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <DomainRow
                  key={domain._id}
                  host={domain.host}
                  verified={domain.verified}
                  onVerify={async () => {
                    'use server';
                    await verifyDomainAction(domain._id, domain.host);
                  }}
                  onRemove={async () => {
                    'use server';
                    await removeDomainAction(domain._id, domain.host);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
