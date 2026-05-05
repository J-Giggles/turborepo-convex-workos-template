import { notFound } from 'next/navigation';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { PostForm, type PostFormValues } from '../../../../../components/post-form';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await fetchQuery(api.posts.getById, { id: id as Id<'posts'> });
  if (!post) notFound();

  // Capture id for the inner closure: TypeScript's narrowing from `if (!post) notFound()`
  // doesn't carry into the async server function below.
  const postId: Id<'posts'> = post._id;

  async function save(values: PostFormValues) {
    'use server';
    const { slug: _slug, ...patch } = values;
    await fetchMutation(api.posts.update, { id: postId, ...patch });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Edit post</h1>
      <PostForm
        initialValues={{
          title: post.title,
          slug: post.slug,
          body: post.body,
          published: post.published,
        }}
        submitLabel="Save"
        action={save}
      />
    </div>
  );
}
