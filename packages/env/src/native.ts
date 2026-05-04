import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const nativeSchema = {
  CONVEX_URL: z.string().url(),
  AUTHKIT_DOMAIN: z.string().url(),
  AUTHKIT_REDIRECT_URI: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
} as const;

/** Call from `apps/native/src/env.ts`. Throws on invalid env at app boot. */
export function createNativeEnv() {
  return createEnv({
    server: {},
    clientPrefix: '',
    client: nativeSchema,
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
}
