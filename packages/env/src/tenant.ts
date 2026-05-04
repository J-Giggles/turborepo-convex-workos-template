import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';
import {
  authkitClientSchema,
  convexClientSchema,
  workosServerSchema,
  workosSessionSchema,
} from './serverShared';

export const tenantServerSchema = {
  ...workosServerSchema,
  ...workosSessionSchema,
} as const;

export const tenantClientSchema = {
  ...convexClientSchema,
  ...authkitClientSchema,
  /** Apex domain (e.g. `example.com`) — proxy.ts uses this to split host into `{slug}.{root}`. */
  NEXT_PUBLIC_PLATFORM_ROOT: z.string().min(1),
} as const;

/** Call from `apps/tenant/env.ts`. Throws on invalid env at app boot. */
export function createTenantEnv() {
  return createEnv({
    server: tenantServerSchema,
    clientPrefix: 'NEXT_PUBLIC_',
    client: tenantClientSchema,
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
}
