import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { formatPostDate } from '../../../../lib/format';

async function getPost(orgId: Id<'organizations'>, postSlug: string) {
  'use cache';
  cacheTag(`post:${orgId}:${postSlug}`);
  cacheLife('hours');
  return await fetchQuery(api.posts.getPublishedBySlug, { orgId, slug: postSlug });
}

async function resolveOrg(slug: string) {
  'use cache';
  cacheTag(`tenant:slug:${slug}`);
  cacheLife('hours');
  return await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const org = await resolveOrg(slug);
  if (!org) return { title: 'Not found' };
  const post = await getPost(org._id, postSlug);
  if (!post) return { title: 'Not found' };
  return {
    title: `${post.title} — ${org.name}`,
    description: post.body.slice(0, 160),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const org = await resolveOrg(slug);
  if (!org) notFound();
  const post = await getPost(org._id, postSlug);
  if (!post) notFound();

  return (
    <article className="prose prose-neutral max-w-none">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">{post.title}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {formatPostDate(post.createdAt)}
        </p>
      </header>
      <div className="whitespace-pre-wrap leading-7">{post.body}</div>
    </article>
  );
}
