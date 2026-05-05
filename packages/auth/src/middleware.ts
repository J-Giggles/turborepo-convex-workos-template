import { authkitMiddleware as workosAuthkitMiddleware } from '@workos-inc/authkit-nextjs';
import type { NextFetchEvent, NextRequest } from 'next/server';

export interface AuthkitMiddlewareConfig {
  /** Routes that require an authenticated user. Use Next.js path-matching syntax. */
  protectedRoutes?: string[];
  /** Where to send unauthenticated requests for protected routes. Default: `/sign-in`. */
  signInPath?: string;
  /** Optional override for the AuthKit return URL after sign-in. */
  redirectUri?: string;
}

/**
 * Build an AuthKit-aware middleware function for a Next.js 16 `proxy.ts`.
 * Consumers call this from their app's `proxy.ts`:
 *
 * ```ts
 * // apps/dashboard/proxy.ts
 * export default authkitMiddleware({ protectedRoutes: ['/posts/:path*'] });
 * ```
 */
export function authkitMiddleware(config: AuthkitMiddlewareConfig = {}) {
  return async (request: NextRequest, event: NextFetchEvent) => {
    const handler = workosAuthkitMiddleware({
      middlewareAuth: {
        enabled: Boolean(config.protectedRoutes?.length),
        unauthenticatedPaths: [],
      },
      redirectUri: config.redirectUri,
    });
    return handler(request, event);
  };
}
