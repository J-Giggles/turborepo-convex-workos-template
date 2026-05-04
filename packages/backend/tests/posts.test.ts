import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';

const modules: Record<string, () => Promise<unknown>> = {
  '../convex/_generated/api.js': () => import('../convex/_generated/api.js'),
  '../convex/_generated/server.js': () => import('../convex/_generated/server.js'),
  '../convex/posts.ts': () => import('../convex/posts.js'),
  '../convex/schema.ts': () => import('../convex/schema.js'),
  '../convex/workosSync.ts': () => import('../convex/workosSync.js'),
  '../convex/http.ts': () => import('../convex/http.js'),
  '../convex/auth.config.ts': () => import('../convex/auth.config.js'),
};

describe('posts', () => {
  it('listPublishedByOrg returns only published posts for the given org', async () => {
    const t = convexTest(schema, modules);
    const orgId = await t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        workosOrgId: 'org_1',
        slug: 'acme',
        name: 'Acme',
        createdAt: 0,
      }),
    );
    const otherOrgId = await t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        workosOrgId: 'org_2',
        slug: 'other',
        name: 'Other',
        createdAt: 0,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert('posts', {
        orgId,
        authorWorkosUserId: 'u1',
        title: 'Published',
        body: 'b',
        slug: 'published',
        published: true,
        createdAt: 1,
      });
      await ctx.db.insert('posts', {
        orgId,
        authorWorkosUserId: 'u1',
        title: 'Draft',
        body: 'b',
        slug: 'draft',
        published: false,
        createdAt: 2,
      });
      await ctx.db.insert('posts', {
        orgId: otherOrgId,
        authorWorkosUserId: 'u1',
        title: 'Other org',
        body: 'b',
        slug: 'other',
        published: true,
        createdAt: 3,
      });
    });

    const result = await t.query(api.posts.listPublishedByOrg, { orgId });
    expect(result.map((p) => p.slug)).toEqual(['published']);
  });
});
