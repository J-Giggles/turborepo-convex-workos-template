import { z } from 'zod';

/**
 * Server-only WorkOS schema. Used by dashboard + tenant apps.
 * (Backend never reads these from process.env locally — they live on the
 *  Convex deployment, set via `npx convex env set`.)
 */
export const workosServerSchema = {
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
} as const;

/** Cookie session sealer. Min 32 chars for AuthKit cookie encryption. */
export const workosSessionSchema = {
  WORKOS_COOKIE_PASSWORD: z.string().min(32),
  WORKOS_REDIRECT_URI: z.string().url(),
} as const;

/** Vercel REST API — used by dashboard for custom-domain provisioning. */
export const vercelApiSchema = {
  VERCEL_API_TOKEN: z.string().min(1),
  VERCEL_TEAM_ID: z.string().min(1),
  VERCEL_PROJECT_ID_TENANT: z.string().min(1),
} as const;

/** Optional CI deploy key. Apps don't need this unless deploying via CI. */
export const convexCiSchema = {
  CONVEX_DEPLOY_KEY: z.string().optional(),
} as const;

/** Browser-side env every Next.js app needs. */
export const convexClientSchema = {
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
} as const;

/** AuthKit issuer — needed at module load by `@workos-inc/authkit-nextjs`. */
export const authkitClientSchema = {
  NEXT_PUBLIC_AUTHKIT_DOMAIN: z.string().url(),
} as const;

// Backwards-compat re-exports for the schemas defined in Plan 1 Task 4.
export const serverSharedSchema = {
  ...workosServerSchema,
  ...workosSessionSchema,
  ...convexCiSchema,
} as const;
export const clientSharedSchema = convexClientSchema;
