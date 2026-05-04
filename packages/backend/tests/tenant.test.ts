import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';

const modules: Record<string, () => Promise<unknown>> = {
  '../convex/_generated/api.js': () => import('../convex/_generated/api.js'),
  '../convex/_generated/server.js': () => import('../convex/_generated/server.js'),
  '../convex/tenant.ts': () => import('../convex/tenant.js'),
  '../convex/schema.ts': () => import('../convex/schema.js'),
  '../convex/workosSync.ts': () => import('../convex/workosSync.js'),
  '../convex/http.ts': () => import('../convex/http.js'),
  '../convex/auth.config.ts': () => import('../convex/auth.config.js'),
};

describe('tenant.getByHost', () => {
  it('returns the org for a verified custom domain', async () => {
    const t = convexTest(schema, modules);
    const orgId = await t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        workosOrgId: 'o1',
        slug: 'acme',
        name: 'Acme',
        createdAt: 0,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert('domains', {
        orgId,
        host: 'app.acmecorp.com',
        isPrimary: true,
        verified: true,
        vercelConfigId: null,
      }),
    );
    const result = await t.query(api.tenant.getByHost, { host: 'app.acmecorp.com' });
    expect(result?.slug).toBe('acme');
  });

  it('returns null for an unverified custom domain', async () => {
    const t = convexTest(schema, modules);
    const orgId = await t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        workosOrgId: 'o1',
        slug: 'acme',
        name: 'Acme',
        createdAt: 0,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert('domains', {
        orgId,
        host: 'pending.com',
        isPrimary: false,
        verified: false,
        vercelConfigId: null,
      }),
    );
    const result = await t.query(api.tenant.getByHost, { host: 'pending.com' });
    expect(result).toBeNull();
  });

  it('returns the org for a platform subdomain when slug exists', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        workosOrgId: 'o1',
        slug: 'acme',
        name: 'Acme',
        createdAt: 0,
      }),
    );
    const result = await t.query(api.tenant.getByHost, {
      host: 'acme.example.com',
      platformRoot: 'example.com',
    });
    expect(result?.slug).toBe('acme');
  });
});
