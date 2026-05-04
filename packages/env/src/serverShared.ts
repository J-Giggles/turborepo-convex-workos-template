import { z } from 'zod';

export const serverSharedSchema = {
  WORKOS_CLIENT_ID: z.string().min(1),
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_COOKIE_PASSWORD: z.string().min(32),
  WORKOS_REDIRECT_URI: z.string().url(),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
  CONVEX_DEPLOY_KEY: z.string().optional(),
} as const;

export const clientSharedSchema = {
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
} as const;
