import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';

export const getByWorkosId = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }): Promise<Doc<'organizations'> | null> => {
    return await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', workosOrgId))
      .unique();
  },
});
