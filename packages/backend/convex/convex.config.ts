import { defineApp } from 'convex/server';
import workosAuthKit from '@convex-dev/workos-authkit/convex.config';
import migrations from '@convex-dev/migrations/convex.config';

const app = defineApp();
app.use(workosAuthKit);
app.use(migrations);

export default app;
