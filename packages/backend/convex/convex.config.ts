import { defineApp } from 'convex/server';
import workosAuthKit from '@convex-dev/workos-authkit/convex.config';
import migrations from '@convex-dev/migrations/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import aggregate from '@convex-dev/aggregate/convex.config';

const app = defineApp();
app.use(workosAuthKit);
app.use(migrations);
app.use(rateLimiter);
app.use(aggregate, { name: 'postsByOrg' });

export default app;
