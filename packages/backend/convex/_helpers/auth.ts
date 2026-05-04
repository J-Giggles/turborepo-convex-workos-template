import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export type Identity = NonNullable<Awaited<ReturnType<QueryCtx['auth']['getUserIdentity']>>>;

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity;
}

export async function requireOrgMembership(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<'organizations'>,
): Promise<{ identity: Identity; role: 'admin' | 'member' }> {
  const identity = await requireUser(ctx);
  const member = await ctx.db
    .query('members')
    .withIndex('by_workos_user_id_and_org_id', (q) =>
      q.eq('workosUserId', identity.subject).eq('orgId', orgId),
    )
    .unique();
  if (!member) throw new Error('Not a member of this organization');
  return { identity, role: member.role };
}
