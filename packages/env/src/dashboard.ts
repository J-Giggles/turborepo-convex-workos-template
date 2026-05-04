import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import {
  authkitClientSchema,
  convexClientSchema,
  vercelApiSchema,
  workosServerSchema,
  workosSessionSchema,
} from './serverShared';

export const dashboardServerSchema = {
  ...workosServerSchema,
  ...workosSessionSchema,
  ...vercelApiSchema,
} as const;

export const dashboardClientSchema = {
  ...convexClientSchema,
  ...authkitClientSchema,
  NEXT_PUBLIC_DASHBOARD_URL: z.string().url(),
} as const;

/** Call from `apps/dashboard/env.ts`. Throws on invalid env at app boot. */
export function createDashboardEnv() {
  return createEnv({
    server: dashboardServerSchema,
    clientPrefix: 'NEXT_PUBLIC_',
    client: dashboardClientSchema,
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
}
