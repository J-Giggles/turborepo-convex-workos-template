import { v } from 'convex/values';
import { query } from './_generated/server';

export const countByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const rows = await ctx.db
      .query('members')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
    return rows.length;
  },
});

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const members = await ctx.db
      .query('members')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
    // Resolve member -> user for the list page in Task 12.
    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', m.workosUserId))
          .unique();
        return { member: m, user };
      }),
    );
  },
});
