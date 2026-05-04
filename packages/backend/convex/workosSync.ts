import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const upsertUser = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.union(v.string(), v.null()),
    avatarUrl: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', args.workosUserId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert('users', args);
  },
});

export const deleteUser = internalMutation({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', args.workosUserId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertOrganization = internalMutation({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', args.workosOrgId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name });
      return existing._id;
    }
    return await ctx.db.insert('organizations', {
      workosOrgId: args.workosOrgId,
      slug: slugify(args.name),
      name: args.name,
      createdAt: Date.now(),
    });
  },
});

export const deleteOrganization = internalMutation({
  args: { workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', args.workosOrgId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertMembership = internalMutation({
  args: {
    workosUserId: v.string(),
    workosOrgId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', args.workosOrgId))
      .unique();
    if (!org) throw new Error(`Org ${args.workosOrgId} not found`);
    const existing = await ctx.db
      .query('members')
      .withIndex('by_workos_user_id_and_org_id', (q) =>
        q.eq('workosUserId', args.workosUserId).eq('orgId', org._id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    return await ctx.db.insert('members', {
      workosUserId: args.workosUserId,
      orgId: org._id,
      role: args.role,
    });
  },
});

export const deleteMembership = internalMutation({
  args: { workosUserId: v.string(), workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', args.workosOrgId))
      .unique();
    if (!org) return;
    const existing = await ctx.db
      .query('members')
      .withIndex('by_workos_user_id_and_org_id', (q) =>
        q.eq('workosUserId', args.workosUserId).eq('orgId', org._id),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
