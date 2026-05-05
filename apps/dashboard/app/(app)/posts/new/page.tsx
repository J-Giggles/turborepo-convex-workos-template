import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import { PostForm, type PostFormValues } from '../../../../components/post-form';
import { readActiveOrg } from '../../../../lib/active-org';

export default async function NewPostPage() {
  const { org } = await readActiveOrg();

  async function create(values: PostFormValues) {
    'use server';
    await fetchMutation(api.posts.create, { ...values, orgId: org._id });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">New post</h1>
      <PostForm
        initialValues={{ title: '', slug: '', body: '', published: false }}
        submitLabel="Create"
        action={create}
      />
    </div>
  );
}
