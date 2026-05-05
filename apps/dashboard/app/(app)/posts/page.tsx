import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { Button } from '@repo/ui/components/button';
import { Badge } from '@repo/ui/components/badge';
import { readActiveOrg } from '../../../lib/active-org';
import { DeleteButton } from '../../../components/delete-button';
import { deletePost } from './actions';

export default async function PostsPage() {
  const { org } = await readActiveOrg();
  const posts = await fetchQuery(api.posts.listAllByOrg, { orgId: org._id });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <Button asChild>
          <Link href="/posts/new">New post</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-muted-foreground)]">
          No posts yet. <Link className="underline" href="/posts/new">Create your first.</Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--color-muted)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post._id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{post.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {post.slug}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={post.published ? 'default' : 'secondary'}>
                      {post.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="flex justify-end gap-1 px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/posts/${post._id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteButton
                      itemLabel={`post "${post.title}"`}
                      action={async () => {
                        'use server';
                        await deletePost(post._id as Id<'posts'>);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
