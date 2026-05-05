import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Badge } from '@repo/ui/components/badge';
import { readActiveOrg } from '../../../lib/active-org';

export default async function MembersPage() {
  const { org } = await readActiveOrg();
  const rows = await fetchQuery(api.members.listByOrg, { orgId: org._id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Synced from WorkOS. To invite or remove members, use your{' '}
          <a className="underline" href="https://dashboard.workos.com" target="_blank" rel="noreferrer">
            WorkOS dashboard
          </a>
          .
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, user }) => (
              <tr key={member._id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{user?.email ?? '(unsynced user)'}</td>
                <td className="px-4 py-2">{user?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
