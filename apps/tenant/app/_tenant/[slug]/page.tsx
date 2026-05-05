import { fetchQuery } from 'convex/nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { PostCard } from '../../../components/post-card';

async function listPosts(orgId: Id<'organizations'>) {
  'use cache';
  cacheTag(`posts:org:${orgId}`);
  cacheLife('minutes');
  return await fetchQuery(api.posts.listPublishedByOrg, { orgId });
}

export default async function TenantIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Re-resolve via the cached layout helper isn't available cross-request; refetch.
  const org = await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
  if (!org) return null;

  const posts = await listPosts(org._id);

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--color-muted-foreground)]">
        No posts yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <PostCard
          key={post._id}
          title={post.title}
          body={post.body}
          slug={post.slug}
          createdAt={post.createdAt}
        />
      ))}
    </div>
  );
}
