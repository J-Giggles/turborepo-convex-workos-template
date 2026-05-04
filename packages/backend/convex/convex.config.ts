import { defineApp } from 'convex/server';
import workosAuthKit from '@convex-dev/workos-authkit/convex.config';

const app = defineApp();
app.use(workosAuthKit);

export default app;
