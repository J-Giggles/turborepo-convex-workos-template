'use server';

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath, updateTag } from 'next/cache';

export async function deletePost(id: Id<'posts'>): Promise<void> {
  // Read post + org BEFORE deleting so we know which tenant cache to invalidate.
  const post = await fetchQuery(api.posts.getById, { id });
  await fetchMutation(api.posts.remove, { id });
  revalidatePath('/posts');
  if (post) {
    // Server Action — use updateTag for read-your-own-writes semantics
    // (Next.js 16 revalidateTag now requires a profile arg; updateTag does not).
    updateTag(`posts:org:${post.orgId}`);
    updateTag(`post:${post.orgId}:${post.slug}`);
  }
}
