import { Migrations } from '@convex-dev/migrations';
import { components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';

export const migrations = new Migrations<DataModel>(components.migrations);

export const lowercasePostSlugs = migrations.define({
  table: 'posts',
  migrateOne: (ctx, post) => {
    if (post.slug !== post.slug.toLowerCase()) {
      return { slug: post.slug.toLowerCase() };
    }
  },
});

export const runAll = migrations.runner([internal.migrations.lowercasePostSlugs]);
