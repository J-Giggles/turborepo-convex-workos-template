import { TableAggregate } from '@convex-dev/aggregate';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import type { Id } from './_generated/dataModel';

export const postsByOrg = new TableAggregate<{
  Namespace: Id<'organizations'>;
  Key: number;
  DataModel: DataModel;
  TableName: 'posts';
}>(components.postsByOrg, {
  namespace: (post) => post.orgId,
  sortKey: (post) => post.createdAt,
});
