import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';

export const getByHost = query({
  args: {
    host: v.string(),
    platformRoot: v.optional(v.string()),
  },
  handler: async (ctx, { host, platformRoot }): Promise<Doc<'organizations'> | null> => {
    const lowercaseHost = host.toLowerCase();

    const verifiedDomain = await ctx.db
      .query('domains')
      .withIndex('by_host', (q) => q.eq('host', lowercaseHost))
      .unique();
    if (verifiedDomain && verifiedDomain.verified) {
      return await ctx.db.get(verifiedDomain.orgId);
    }

    if (platformRoot) {
      const root = platformRoot.toLowerCase();
      if (lowercaseHost.endsWith(`.${root}`)) {
        const slug = lowercaseHost.slice(0, lowercaseHost.length - root.length - 1);
        if (slug && !slug.includes('.')) {
          return await ctx.db
            .query('organizations')
            .withIndex('by_slug', (q) => q.eq('slug', slug))
            .unique();
        }
      }
    }

    return null;
  },
});
