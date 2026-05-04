import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter';
import { components } from './_generated/api';

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  publicTenantRead: { kind: 'token bucket', rate: 60, period: MINUTE },
});
