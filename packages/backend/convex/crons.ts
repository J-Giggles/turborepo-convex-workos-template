import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily at 03:00 UTC — diff WorkOS membership against local mirror
crons.cron(
  'reconcileMembers',
  '0 3 * * *',
  internal.scheduledJobs.reconcileMembers,
  {},
);

// Every 5 minutes — poll Vercel Domains API for unverified domains
crons.interval(
  'verifyDomains',
  { minutes: 5 },
  internal.scheduledJobs.verifyDomains,
  {},
);

export default crons;
