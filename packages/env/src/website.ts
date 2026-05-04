import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import { convexClientSchema } from './serverShared';

export const websiteClientSchema = {
  ...convexClientSchema,
  NEXT_PUBLIC_SITE_URL: z.string().url(),
} as const;

/** Call from `apps/website/env.ts` so missing/invalid env fails at app boot. */
export function createWebsiteEnv() {
  return createEnv({
    server: {},
    clientPrefix: 'NEXT_PUBLIC_',
    client: websiteClientSchema,
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
}
