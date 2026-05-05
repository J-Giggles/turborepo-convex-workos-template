import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import { TenantHeader } from '../../../components/tenant-header';

async function getOrgBySlug(slug: string) {
  'use cache';
  cacheTag(`tenant:slug:${slug}`);
  cacheLife('hours');
  // Reuse api.tenant.getByHost with a synthetic host so we hit the same query.
  // The platformRoot path treats the leftmost label as the slug; constructing
  // `<slug>.<root>` works because the resolver uses the same logic.
  return await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return (
    <div className="min-h-screen">
      <TenantHeader orgName={org.name} slug={org.slug} />
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
