import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireOrgMembership } from './_helpers/auth';

export const listPublishedByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query('posts')
      .withIndex('by_org_id_and_published', (q) => q.eq('orgId', orgId).eq('published', true))
      .order('desc')
      .collect();
  },
});

export const listAllByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    await requireOrgMembership(ctx, orgId);
    return await ctx.db
      .query('posts')
      .withIndex('by_org_id_and_published', (q) => q.eq('orgId', orgId))
      .order('desc')
      .collect();
  },
});

export const getPublishedBySlug = query({
  args: { orgId: v.id('organizations'), slug: v.string() },
  handler: async (ctx, { orgId, slug }) => {
    const post = await ctx.db
      .query('posts')
      .withIndex('by_org_id_and_slug', (q) => q.eq('orgId', orgId).eq('slug', slug))
      .unique();
    if (!post || !post.published) return null;
    return post;
  },
});

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    title: v.string(),
    body: v.string(),
    slug: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrgMembership(ctx, args.orgId);
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_org_id_and_slug', (q) => q.eq('orgId', args.orgId).eq('slug', args.slug))
      .unique();
    if (existing) throw new Error('A post with this slug already exists in this organization');
    return await ctx.db.insert('posts', {
      ...args,
      authorWorkosUserId: identity.subject,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('posts'),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('Post not found');
    await requireOrgMembership(ctx, existing.orgId);
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(id, cleanPatch);
  },
});

export const remove = mutation({
  args: { id: v.id('posts') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await requireOrgMembership(ctx, existing.orgId);
    await ctx.db.delete(id);
  },
});
