'use server';

import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath } from 'next/cache';

export async function deletePost(id: Id<'posts'>): Promise<void> {
  await fetchMutation(api.posts.remove, { id });
  revalidatePath('/posts');
}
