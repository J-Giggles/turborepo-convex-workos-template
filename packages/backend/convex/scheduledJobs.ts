import { internalAction } from './_generated/server';

export const reconcileMembers = internalAction({
  args: {},
  handler: async () => {
    console.log('[cron] reconcileMembers — TODO: diff WorkOS membership against local mirror');
  },
});

export const verifyDomains = internalAction({
  args: {},
  handler: async () => {
    console.log('[cron] verifyDomains — TODO: poll Vercel Domains API for unverified domains');
  },
});
