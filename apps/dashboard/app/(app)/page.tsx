import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';
import { readActiveOrg } from '../../lib/active-org';

export default async function HomePage() {
  const { org } = await readActiveOrg();
  const [postCount, memberCount] = await Promise.all([
    fetchQuery(api.posts.countByOrg, { orgId: org._id }),
    fetchQuery(api.members.countByOrg, { orgId: org._id }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {org.name}</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          A snapshot of your organization.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Posts</CardDescription>
            <CardTitle className="text-4xl">{postCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-4xl">{memberCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
