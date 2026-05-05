import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';

/**
 * Seed a fake organization + a couple of demo posts so the tenant runtime can
 * be exercised end-to-end without provisioning real WorkOS orgs or DNS.
 *
 * Refuses to run when CONVEX_CLOUD_URL contains "prod" — a deliberately blunt
 * guard. Callers in CI should set CONVEX_DEPLOYMENT to a dev deployment.
 */
export const seedTestOrg = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    if ((process.env.CONVEX_CLOUD_URL ?? '').includes('prod')) {
      throw new Error('seedTestOrg refuses to run against a prod deployment.');
    }

    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) return existing._id;

    const orgId = await ctx.db.insert('organizations', {
      workosOrgId: `seed_${slug}`,
      slug,
      name,
      createdAt: Date.now(),
    });

    // Two demo posts — one published, one draft — so the tenant index has
    // content immediately.
    await ctx.db.insert('posts', {
      orgId,
      authorWorkosUserId: `seed_user_${slug}`,
      title: `Welcome to ${name}`,
      body: `This is a seeded post. Replace it via the dashboard once you've connected real WorkOS auth.`,
      slug: 'welcome',
      published: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert('posts', {
      orgId,
      authorWorkosUserId: `seed_user_${slug}`,
      title: 'Draft — not visible publicly',
      body: 'Drafts are filtered out by listPublishedByOrg.',
      slug: 'draft',
      published: false,
      createdAt: Date.now(),
    });

    return orgId;
  },
});

/**
 * Internal counterpart for use in test fixtures (convex-test) where running a
 * top-level mutation is awkward. Identical guard.
 */
export const _seedTestOrgInternal = internalMutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    if ((process.env.CONVEX_CLOUD_URL ?? '').includes('prod')) {
      throw new Error('seedTestOrg refuses to run against a prod deployment.');
    }
    return await ctx.db.insert('organizations', {
      workosOrgId: `seed_${args.slug}`,
      slug: args.slug,
      name: args.name,
      createdAt: 0,
    });
  },
});
