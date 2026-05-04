import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/workos/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WORKOS_WEBHOOK_SECRET;
    if (!secret) return new Response('Webhook secret not configured', { status: 500 });

    const signature = request.headers.get('workos-signature');
    if (!signature) return new Response('Missing signature', { status: 401 });

    const rawBody = await request.text();
    const verified = await verifyWorkosSignature(rawBody, signature, secret);
    if (!verified) return new Response('Bad signature', { status: 401 });

    const event = JSON.parse(rawBody) as WorkosEvent;

    switch (event.event) {
      case 'user.created':
      case 'user.updated':
        await ctx.runMutation(internal.workosSync.upsertUser, {
          workosUserId: event.data.id,
          email: event.data.email,
          name:
            [event.data.first_name, event.data.last_name].filter(Boolean).join(' ').trim() ||
            null,
          avatarUrl: event.data.profile_picture_url ?? null,
        });
        break;
      case 'user.deleted':
        await ctx.runMutation(internal.workosSync.deleteUser, {
          workosUserId: event.data.id,
        });
        break;
      case 'organization.created':
      case 'organization.updated':
        await ctx.runMutation(internal.workosSync.upsertOrganization, {
          workosOrgId: event.data.id,
          name: event.data.name,
        });
        break;
      case 'organization.deleted':
        await ctx.runMutation(internal.workosSync.deleteOrganization, {
          workosOrgId: event.data.id,
        });
        break;
      case 'organization_membership.created':
      case 'organization_membership.updated':
        await ctx.runMutation(internal.workosSync.upsertMembership, {
          workosUserId: event.data.user_id,
          workosOrgId: event.data.organization_id,
          role: event.data.role?.slug === 'admin' ? 'admin' : 'member',
        });
        break;
      case 'organization_membership.deleted':
        await ctx.runMutation(internal.workosSync.deleteMembership, {
          workosUserId: event.data.user_id,
          workosOrgId: event.data.organization_id,
        });
        break;
    }

    return new Response('ok', { status: 200 });
  }),
});

type WorkosEvent =
  | { event: 'user.created' | 'user.updated'; data: { id: string; email: string; first_name?: string; last_name?: string; profile_picture_url?: string } }
  | { event: 'user.deleted'; data: { id: string } }
  | { event: 'organization.created' | 'organization.updated'; data: { id: string; name: string } }
  | { event: 'organization.deleted'; data: { id: string } }
  | {
      event: 'organization_membership.created' | 'organization_membership.updated';
      data: { user_id: string; organization_id: string; role?: { slug: string } };
    }
  | {
      event: 'organization_membership.deleted';
      data: { user_id: string; organization_id: string };
    };

async function verifyWorkosSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=') as [string, string]),
  );
  const t = parts.t;
  const sig = parts.v1;
  if (!t || !sig) return false;
  const tolerance = 5 * 60 * 1000;
  if (Math.abs(Date.now() - Number(t) * 1000) > tolerance) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expectedHex, sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default http;
