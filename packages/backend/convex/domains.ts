import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireOrgMembership } from './_helpers/auth';

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    await requireOrgMembership(ctx, orgId);
    return await ctx.db
      .query('domains')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
  },
});

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    host: v.string(),
    isPrimary: v.boolean(),
    vercelConfigId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireOrgMembership(ctx, args.orgId);
    const lowercaseHost = args.host.toLowerCase();
    const existing = await ctx.db
      .query('domains')
      .withIndex('by_host', (q) => q.eq('host', lowercaseHost))
      .unique();
    if (existing) throw new Error('That domain is already registered.');
    return await ctx.db.insert('domains', {
      ...args,
      host: lowercaseHost,
      verified: false,
    });
  },
});

export const setVerified = mutation({
  args: { id: v.id('domains'), verified: v.boolean() },
  handler: async (ctx, { id, verified }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await requireOrgMembership(ctx, existing.orgId);
    await ctx.db.patch(id, { verified });
  },
});

export const remove = mutation({
  args: { id: v.id('domains') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await requireOrgMembership(ctx, existing.orgId);
    await ctx.db.delete(id);
  },
});
