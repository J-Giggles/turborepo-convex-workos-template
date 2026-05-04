import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  organizations: defineTable({
    workosOrgId: v.string(),
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
  })
    .index('by_workos_org_id', ['workosOrgId'])
    .index('by_slug', ['slug']),

  domains: defineTable({
    orgId: v.id('organizations'),
    host: v.string(),
    isPrimary: v.boolean(),
    verified: v.boolean(),
    vercelConfigId: v.union(v.string(), v.null()),
  })
    .index('by_host', ['host'])
    .index('by_org_id', ['orgId']),

  members: defineTable({
    workosUserId: v.string(),
    orgId: v.id('organizations'),
    role: v.union(v.literal('admin'), v.literal('member')),
  })
    .index('by_workos_user_id_and_org_id', ['workosUserId', 'orgId'])
    .index('by_org_id', ['orgId']),

  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    name: v.union(v.string(), v.null()),
    avatarUrl: v.union(v.string(), v.null()),
  }).index('by_workos_user_id', ['workosUserId']),

  posts: defineTable({
    orgId: v.id('organizations'),
    authorWorkosUserId: v.string(),
    title: v.string(),
    body: v.string(),
    slug: v.string(),
    published: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_org_id_and_published', ['orgId', 'published'])
    .index('by_org_id_and_slug', ['orgId', 'slug']),
});
