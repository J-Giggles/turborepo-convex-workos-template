# Tenant Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `apps/tenant` — a public, multi-tenant Next.js 16 runtime at `localhost:3002` that resolves the request `Host` header to a Convex `organization` (subdomain like `acme.localhost:3002` OR custom domain like `app.acmecorp.com`), rewrites internally to a slug-scoped route group, and renders the org's published posts. The dashboard's "Add domain" flow (Plan 3 Task 14) terminates here once Vercel DNS verification passes.

**Architecture:** A single Next.js 16 app handles every tenant. `proxy.ts` (Next.js's renamed middleware) reads the `Host` header on every request, calls `api.tenant.getByHost` (Plan 1 Task 11), and rewrites internally to `/_tenant/[slug]/...` so the slug is never visible in the URL. The host → org lookup is wrapped in Vercel's [Runtime Cache API](https://vercel.com/docs/runtime-cache) keyed by host with tag `tenant:{host}` so domain CRUD in the dashboard can `updateTag()` to invalidate. The apex (`localhost:3002` or `example.com` in prod) redirects permanently to the marketing website. No auth — the tenant app is public-read by design; the rate-limiter token-bucket from Plan 1 Task 13 protects the read path.

**Tech Stack:** Next.js 16 App Router, React 19, `@repo/ui`, `@repo/env/tenant`, `@repo/backend`, `convex/nextjs` (server-side fetch), Vercel Runtime Cache (`@vercel/cache` — public beta API). Existing template stack — pnpm 9, Turborepo 2, ESLint 9 flat config, Prettier 3, Tailwind v4.

**Reference spec:** `docs/superpowers/specs/2026-05-04-turborepo-convex-workos-template-design.md` (especially §5 — multi-tenant routing is the load-bearing piece for this plan).
**Builds on:**
- Plan 1 (`docs/superpowers/plans/plan-01-2026-05-04-foundation-and-backend.md`), tagged `foundation-and-backend-complete`
- Plan 2 (`docs/superpowers/plans/plan-02-2026-05-05-web-shared-and-website.md`), tagged `website-and-shared-complete`
- Plan 3 (`docs/superpowers/plans/plan-03-2026-05-05-dashboard.md`), tagged `dashboard-complete`

---

## Pre-flight

- Working directory: `/home/jgigg/code/turborepo-convex-workos-template`.
- Should be executed in a worktree off `main` after Plans 2 + 3 have merged:
  ```bash
  git worktree add ../turborepo-convex-workos-template-tenant -b plan-4-tenant-runtime
  ```
- Convex deployment is live with placeholder WorkOS env vars (Plan 1).
- For local multi-tenant testing you need browseable subdomains. Two options:
  - **Use `localhost` subdomains** (Chrome/Safari resolve `*.localhost` to `127.0.0.1` automatically) — `acme.localhost:3002` works out-of-the-box on Chrome 122+ and Safari 17+. This is the recommended path for the template.
  - Otherwise add `127.0.0.1 acme.example.test` to `/etc/hosts` and use `acme.example.test:3002`. Don't use `*.dev` (browser HTTPS hardcoded).
- A test organization in Convex with `slug = "acme"` is required to exercise the platform-subdomain path. Either:
  - Sign in to the dashboard once with a real WorkOS account → org auto-syncs via webhook
  - OR seed manually:
    ```bash
    cd packages/backend
    npx convex run organizations:list                                      # check what's there
    npx convex run debugUtils:seedTestOrg '{"slug": "acme", "name": "Acme"}'  # via the seed helper added in Task 0
    ```
- Node 20.19.4+, pnpm 9.
- Git author for all commits: `Jordan <jordan@lifepass.eu>` via `-c user.name=Jordan -c user.email=jordan@lifepass.eu`.

---

## File map

```
packages/backend/convex/
└── debugUtils.ts                           # NEW — seedTestOrg + a couple of dev-only helpers
                                            #   (gated to run only against dev deployments)

apps/tenant/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.js
├── next-env.d.ts
├── env.ts                                  # createTenantEnv() at module-load
├── proxy.ts                                # host → org rewrite + cache
├── app/
│   ├── layout.tsx                          # root layout, font, metadata (org-aware)
│   ├── globals.css                         # imports @repo/ui/styles/globals.css
│   ├── page.tsx                            # apex redirect → marketing site
│   ├── _tenant/
│   │   └── [slug]/
│   │       ├── layout.tsx                  # tenant-aware shell, brand strip
│   │       ├── page.tsx                    # tenant landing — list of published posts
│   │       └── [postSlug]/page.tsx         # individual published post
│   ├── not-found.tsx                       # rendered when host resolves to nothing
│   └── disabled/page.tsx                   # rendered when domain row is unverified
├── components/
│   ├── tenant-header.tsx                   # name + tagline strip
│   └── post-card.tsx                       # link card for the index
└── lib/
    ├── resolve-tenant.ts                   # server — cached host → org lookup
    └── format.ts                           # tiny date formatter
```

---

## Task 0: Backend — dev-only seed helper

**Why this isn't in Plan 1:** Plans 2/3 imply you can sign into AuthKit and create an org through the WorkOS UI to drive the webhook sync. For Plan 4 we want a frictionless way to test multi-tenant routing without provisioning real WorkOS orgs or DNS — a tiny seed helper. Gated to dev deployments only so it can't accidentally run in prod.

**Files:**
- Create: `packages/backend/convex/debugUtils.ts`

- [ ] **Step 0.1: Write `packages/backend/convex/debugUtils.ts`**

```ts
import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';

/**
 * Seed a fake organization + a couple of demo posts so the tenant runtime can
 * be exercised end-to-end without provisioning real WorkOS orgs or DNS.
 *
 * Refuses to run when CONVEX_CLOUD_URL contains "prod" — a deliberately blunt
 * guard. Callers in CI should set CONVEX_DEPLOYMENT to a dev deployment.
 */
export const seedTestOrg = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    if ((process.env.CONVEX_CLOUD_URL ?? '').includes('prod')) {
      throw new Error('seedTestOrg refuses to run against a prod deployment.');
    }

    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .unique();
    if (existing) return existing._id;

    const orgId = await ctx.db.insert('organizations', {
      workosOrgId: `seed_${slug}`,
      slug,
      name,
      createdAt: Date.now(),
    });

    // Two demo posts — one published, one draft — so the tenant index has
    // content immediately.
    await ctx.db.insert('posts', {
      orgId,
      authorWorkosUserId: `seed_user_${slug}`,
      title: `Welcome to ${name}`,
      body: `This is a seeded post. Replace it via the dashboard once you've connected real WorkOS auth.`,
      slug: 'welcome',
      published: true,
      createdAt: Date.now(),
    });
    await ctx.db.insert('posts', {
      orgId,
      authorWorkosUserId: `seed_user_${slug}`,
      title: 'Draft — not visible publicly',
      body: 'Drafts are filtered out by listPublishedByOrg.',
      slug: 'draft',
      published: false,
      createdAt: Date.now(),
    });

    return orgId;
  },
});

/**
 * Internal counterpart for use in test fixtures (convex-test) where running a
 * top-level mutation is awkward. Identical guard.
 */
export const _seedTestOrgInternal = internalMutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    if ((process.env.CONVEX_CLOUD_URL ?? '').includes('prod')) {
      throw new Error('seedTestOrg refuses to run against a prod deployment.');
    }
    return await ctx.db.insert('organizations', {
      workosOrgId: `seed_${args.slug}`,
      slug: args.slug,
      name: args.name,
      createdAt: 0,
    });
  },
});
```

- [ ] **Step 0.2: Verify codegen + tests still pass**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm --filter @repo/backend dev > /tmp/convex-task0-plan4.log 2>&1 &
CPID=$!
sleep 25
tail -10 /tmp/convex-task0-plan4.log
kill $CPID 2>/dev/null || true
wait $CPID 2>/dev/null || true
grep "debugUtils" packages/backend/convex/_generated/api.d.ts
pnpm --filter @repo/backend test
```

Expected: `Functions ready!`, `debugUtils` appears in the codegen, all 8 existing tests still pass.

- [ ] **Step 0.3: Smoke-run the seed against the dev deployment**

```bash
cd packages/backend
npx convex run debugUtils:seedTestOrg '{"slug": "acme", "name": "Acme"}'
```

Expected: returns a `Id<'organizations'>` (a string starting with the deployment id). If you re-run, it returns the existing orgId — idempotent.

- [ ] **Step 0.4: Commit**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
git add packages/backend/convex/debugUtils.ts packages/backend/convex/_generated
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(backend): add debugUtils.seedTestOrg dev-only helper"
```

---

## Task 1: `apps/tenant` Next.js scaffold

**Files:**
- Create: `apps/tenant/package.json`
- Create: `apps/tenant/tsconfig.json`
- Create: `apps/tenant/next.config.ts`
- Create: `apps/tenant/postcss.config.mjs`
- Create: `apps/tenant/eslint.config.js`
- Create: `apps/tenant/next-env.d.ts`

Mirrors Plan 2 Task 8 (website) and Plan 3 Task 2 (dashboard) — same shape, port 3002, dependencies on `@repo/backend` for the typed Convex client and `@repo/ui` for design parity. Notably **no** `@repo/auth` dependency — this app is public.

- [ ] **Step 1.1: Write `apps/tenant/package.json`**

```json
{
  "name": "tenant",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/backend": "workspace:*",
    "@repo/env": "workspace:*",
    "@repo/ui": "workspace:*",
    "convex": "^1.29.3",
    "next": "^16.1.4",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 1.2: Write `apps/tenant/tsconfig.json`**

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.3: Write `apps/tenant/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui'],
};

export default config;
```

- [ ] **Step 1.4: Write `apps/tenant/postcss.config.mjs`**

```mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 1.5: Write `apps/tenant/eslint.config.js`**

```js
import config from '@repo/eslint-config/nextjs';

export default config;
```

- [ ] **Step 1.6: Write `apps/tenant/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 1.7: Install**

```bash
pnpm install
```

Expected: workspace links resolve, Next.js + Convex pulled.

- [ ] **Step 1.8: Commit**

```bash
git add apps/tenant pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): scaffold Next.js 16 app shell"
```

---

## Task 2: Tenant env validation

**Files:**
- Create: `apps/tenant/env.ts`
- Create: `apps/tenant/.env.local.example`

`createTenantEnv()` is already defined in `@repo/env/tenant` (Plan 1 Task 4). It validates server WorkOS creds (for the optional auth flow) + `NEXT_PUBLIC_AUTHKIT_DOMAIN` + `NEXT_PUBLIC_PLATFORM_ROOT` + `NEXT_PUBLIC_CONVEX_URL`.

> The existing `tenantServerSchema` makes WorkOS server creds REQUIRED. For Plan 4's pure-public-read scope they're not actually used, but they're declared so the dashboard's Plan 3 sign-in flow can re-authenticate against a tenant subdomain later. If you'd prefer a leaner schema for Plan 4 (drop server creds entirely until they're needed), open a follow-up: this plan keeps the schema as-is for forward compatibility.

- [ ] **Step 2.1: Write `apps/tenant/env.ts`**

```ts
import { createTenantEnv } from '@repo/env/tenant';

export const env = createTenantEnv();
```

- [ ] **Step 2.2: Write `apps/tenant/.env.local.example`**

```bash
# Required by every Next.js app to talk to Convex.
NEXT_PUBLIC_CONVEX_URL=

# AuthKit issuer URL (only consumed by tenant routes that opt into auth).
NEXT_PUBLIC_AUTHKIT_DOMAIN=

# Apex domain. proxy.ts splits the request host as `{slug}.{NEXT_PUBLIC_PLATFORM_ROOT}`.
# Local dev convention: `localhost:3002`. Prod: your apex (e.g. `example.com`).
NEXT_PUBLIC_PLATFORM_ROOT=localhost:3002

# WorkOS server credentials. Required by the schema but unused by Plan 4 routes.
# Set them to the same placeholders as packages/backend so env:check passes.
WORKOS_CLIENT_ID=client_placeholder
WORKOS_API_KEY=sk_placeholder
WORKOS_WEBHOOK_SECRET=sk_webhook_placeholder
WORKOS_COOKIE_PASSWORD=00000000000000000000000000000000
WORKOS_REDIRECT_URI=http://localhost:3002/callback
```

- [ ] **Step 2.3: Verify env:check skips when no .env.local exists**

```bash
pnpm env:check
```

Expected: `· tenant  skip — no file at apps/tenant/.env.local`. (Plus other apps' status from prior plans.)

- [ ] **Step 2.4: Create a working `.env.local` for dev**

```bash
cat > apps/tenant/.env.local <<'EOF'
NEXT_PUBLIC_CONVEX_URL=<copy from packages/backend/.env.local>
NEXT_PUBLIC_AUTHKIT_DOMAIN=https://placeholder.authkit.app
NEXT_PUBLIC_PLATFORM_ROOT=localhost:3002
WORKOS_CLIENT_ID=client_placeholder
WORKOS_API_KEY=sk_placeholder
WORKOS_WEBHOOK_SECRET=sk_webhook_placeholder
WORKOS_COOKIE_PASSWORD=00000000000000000000000000000000
WORKOS_REDIRECT_URI=http://localhost:3002/callback
EOF
```

- [ ] **Step 2.5: Verify env:check passes for tenant**

```bash
pnpm env:check
```

Expected: `✓ tenant pass`.

- [ ] **Step 2.6: Commit**

```bash
git add apps/tenant/env.ts apps/tenant/.env.local.example
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): add env validation + .env.local.example"
```

---

## Task 3: Cached host → org lookup

**Files:**
- Create: `apps/tenant/lib/resolve-tenant.ts`

The single load-bearing function for the whole app. Called by `proxy.ts` and by the route handlers — both via the same memoized cache so an apex-style request and a render-time fetch share a single Convex round trip.

The cache is implemented with Next.js 16's [`'use cache'` directive](https://nextjs.org/docs/app/getting-started/cache-components) (the modern replacement for `unstable_cache`) so we get tag-based invalidation and the right runtime semantics. We tag every entry `tenant:{host}` so domain CRUD in the dashboard can call `updateTag('tenant:{host}')` to invalidate.

- [ ] **Step 3.1: Write `apps/tenant/lib/resolve-tenant.ts`**

```ts
import 'server-only';
import { fetchQuery } from 'convex/nextjs';
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Doc } from '@repo/backend/_generated/dataModel';
import { env } from '../env';

export type ResolvedTenant =
  | { kind: 'org'; org: Doc<'organizations'> }
  | { kind: 'apex' }
  | { kind: 'unknown' };

/**
 * Resolve a request Host header to a tenant. Cached by host with tag
 * `tenant:{host}` so the dashboard's domain CRUD can invalidate it via
 * `revalidateTag('tenant:{host}')` immediately after Vercel verification.
 */
export async function resolveTenant(host: string): Promise<ResolvedTenant> {
  'use cache';
  cacheTag(`tenant:${host}`);
  cacheLife('hours');

  const lower = host.toLowerCase();
  const platformRoot = env.NEXT_PUBLIC_PLATFORM_ROOT.toLowerCase();

  // Strip port for apex/subdomain comparison; Convex queries see hostname only.
  const hostNoPort = lower.split(':')[0] ?? '';
  const platformRootNoPort = platformRoot.split(':')[0] ?? '';

  // Exact apex match → marketing redirect target
  if (hostNoPort === platformRootNoPort) {
    return { kind: 'apex' };
  }

  const org = await fetchQuery(api.tenant.getByHost, {
    host: hostNoPort,
    platformRoot: platformRootNoPort,
  });
  return org ? { kind: 'org', org } : { kind: 'unknown' };
}
```

> If `unstable_cacheTag` / `unstable_cacheLife` are unavailable in your Next.js 16 build (the API is GA in 16.1+), fall back to `unstable_cache` with `tags` and a `revalidate` option. Adapt and report.

- [ ] **Step 3.2: Typecheck**

```bash
pnpm --filter tenant typecheck
```

Expected: 0-error exit. `'use cache'` requires Next.js 16's Cache Components flag — should already be on by default. If TypeScript complains about `'use cache'`, check that the project's tsconfig extends Plan 1's `nextjs` preset (which has the Next plugin enabled).

- [ ] **Step 3.3: Commit**

```bash
git add apps/tenant/lib/resolve-tenant.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): add cached host -> org resolver"
```

---

## Task 4: `proxy.ts` — host rewrite

**Files:**
- Create: `apps/tenant/proxy.ts`

The host header drives a single internal rewrite. We don't redirect — the URL the browser sees stays whatever it was (e.g. `acme.localhost:3002/welcome`), and Next.js renders `/_tenant/acme/welcome` server-side.

- [ ] **Step 4.1: Write `apps/tenant/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenant } from './lib/resolve-tenant';

export const config = {
  // Skip statics, API, and the special internal path itself (we set it; we don't re-rewrite).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|_tenant).*)'],
};

export default async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const result = await resolveTenant(host);

  // Apex → redirect to the marketing site. NEXT_PUBLIC_SITE_URL isn't in the
  // tenant schema (different app), so we hardcode the same protocol + host
  // pattern. Adjust here if your marketing site lives somewhere weirder.
  if (result.kind === 'apex') {
    return NextResponse.redirect(new URL('http://localhost:3000', req.url), 308);
  }

  // No matching org → render the not-found route. Don't 404 silently — give
  // the user a friendly message in the rewrite target.
  if (result.kind === 'unknown') {
    return NextResponse.rewrite(new URL('/not-found', req.url));
  }

  // Strip the leading slash from the original pathname and prepend our internal
  // route group: `/_tenant/{slug}/{...rest}`.
  const url = req.nextUrl.clone();
  const rest = url.pathname === '/' ? '' : url.pathname;
  url.pathname = `/_tenant/${result.org.slug}${rest}`;
  return NextResponse.rewrite(url);
}
```

> The apex redirect target is hardcoded to `http://localhost:3000` for dev. In production you'll want this to read from a NEXT_PUBLIC_MARKETING_URL env var — left as an explicit follow-up at the bottom of this plan.

- [ ] **Step 4.2: Typecheck**

```bash
pnpm --filter tenant typecheck
```

Expected: 0-error exit.

- [ ] **Step 4.3: Commit**

```bash
git add apps/tenant/proxy.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): add proxy.ts host -> internal rewrite"
```

---

## Task 5: Root layout + globals + apex page + not-found

**Files:**
- Create: `apps/tenant/app/layout.tsx`
- Create: `apps/tenant/app/globals.css`
- Create: `apps/tenant/app/page.tsx`
- Create: `apps/tenant/app/not-found.tsx`
- Create: `apps/tenant/app/disabled/page.tsx`
- Create: `apps/tenant/app/favicon.ico` (placeholder — empty file)

Apex (`/`) is normally never rendered (proxy.ts redirects), but if proxy.ts is ever bypassed (preview deploys, monitoring health checks), having a sensible apex page prevents an empty 404.

- [ ] **Step 5.1: Write `apps/tenant/app/globals.css`**

```css
@import "@repo/ui/styles/globals.css";
```

- [ ] **Step 5.2: Write `apps/tenant/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  // metadataBase intentionally omitted — each tenant render path overrides
  // it with the resolved org's URL. The default keeps Next.js happy in
  // edge cases (apex, not-found).
  title: 'Tenant',
  description: 'Multi-tenant runtime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5.3: Write `apps/tenant/app/page.tsx`**

```tsx
// Apex renders only if proxy.ts didn't redirect — health-check / preview-deploy fallback.
export default function ApexPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Multi-tenant runtime</h1>
      <p className="text-[var(--color-muted-foreground)]">
        This app serves tenant subdomains and custom domains. The marketing site is at{' '}
        <a className="underline" href="http://localhost:3000">
          localhost:3000
        </a>
        .
      </p>
    </main>
  );
}
```

- [ ] **Step 5.4: Write `apps/tenant/app/not-found.tsx`**

```tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Site not found</h1>
      <p className="text-[var(--color-muted-foreground)]">
        We couldn't find a tenant for this domain. If you just added the domain in your dashboard,
        DNS verification may still be pending.
      </p>
    </main>
  );
}
```

- [ ] **Step 5.5: Write `apps/tenant/app/disabled/page.tsx`**

Reachable when a tenant exists but the domain row is unverified — proxy.ts can rewrite to this in a follow-up if we want to differentiate from "no tenant at all" without leaking org existence to scanners. Plan 4 doesn't wire that yet; the page is here as scaffolding.

```tsx
export default function DisabledPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Site temporarily disabled</h1>
      <p className="text-[var(--color-muted-foreground)]">
        This domain is being verified. Try again in a few minutes.
      </p>
    </main>
  );
}
```

- [ ] **Step 5.6: Empty favicon**

```bash
touch apps/tenant/app/favicon.ico
```

- [ ] **Step 5.7: Typecheck**

```bash
pnpm --filter tenant typecheck
```

Expected: 0-error exit.

- [ ] **Step 5.8: Commit**

```bash
git add apps/tenant/app/layout.tsx apps/tenant/app/globals.css apps/tenant/app/page.tsx apps/tenant/app/not-found.tsx apps/tenant/app/disabled apps/tenant/app/favicon.ico
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): root layout, apex page, not-found, disabled fallback"
```

---

## Task 6: Tenant header + post card components

**Files:**
- Create: `apps/tenant/components/tenant-header.tsx`
- Create: `apps/tenant/components/post-card.tsx`
- Create: `apps/tenant/lib/format.ts`

Two small server components shared between the tenant index and the individual post page. No state, no client JS — kept lean.

- [ ] **Step 6.1: Write `apps/tenant/lib/format.ts`**

```ts
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatPostDate(timestampMs: number): string {
  return dateFormatter.format(new Date(timestampMs));
}
```

- [ ] **Step 6.2: Write `apps/tenant/components/tenant-header.tsx`**

```tsx
import Link from 'next/link';

export function TenantHeader({ orgName, slug }: { orgName: string; slug: string }) {
  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href={`/`} className="text-lg font-semibold tracking-tight">
          {orgName}
        </Link>
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {slug}
        </p>
      </div>
    </header>
  );
}
```

- [ ] **Step 6.3: Write `apps/tenant/components/post-card.tsx`**

```tsx
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';
import { formatPostDate } from '../lib/format';

export function PostCard({
  title,
  body,
  slug,
  createdAt,
}: {
  title: string;
  body: string;
  slug: string;
  createdAt: number;
}) {
  // Take the first ~180 chars of body as a teaser. No markdown rendering at this stage.
  const teaser = body.length > 180 ? `${body.slice(0, 180).trim()}…` : body;
  return (
    <Link href={`/${slug}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{formatPostDate(createdAt)}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-foreground)]">
          {teaser}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 6.4: Typecheck + lint**

```bash
pnpm --filter tenant typecheck && pnpm --filter tenant lint
```

Expected: 0-error exits.

- [ ] **Step 6.5: Commit**

```bash
git add apps/tenant/components apps/tenant/lib/format.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): add tenant header + post card components"
```

---

## Task 7: Tenant routes — index + individual post

**Files:**
- Create: `apps/tenant/app/_tenant/[slug]/layout.tsx`
- Create: `apps/tenant/app/_tenant/[slug]/page.tsx`
- Create: `apps/tenant/app/_tenant/[slug]/[postSlug]/page.tsx`

The `_tenant/[slug]` route group is what `proxy.ts` rewrites to. The `[slug]` param is the resolved org's slug — we re-look-up by slug here (cached) instead of threading the org doc through headers, which keeps the page rendering pure.

- [ ] **Step 7.1: Write `apps/tenant/app/_tenant/[slug]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import { TenantHeader } from '../../../components/tenant-header';

async function getOrgBySlug(slug: string) {
  'use cache';
  cacheTag(`tenant:slug:${slug}`);
  cacheLife('hours');
  // Reuse api.tenant.getByHost with a synthetic host so we hit the same query.
  // The platformRoot path treats the leftmost label as the slug; constructing
  // `<slug>.<root>` works because the resolver uses the same logic.
  return await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return (
    <div className="min-h-screen">
      <TenantHeader orgName={org.name} slug={org.slug} />
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
```

> The `placeholder.invalid` synthetic-host trick relies on `api.tenant.getByHost`'s slug-extraction logic from Plan 1. If you'd rather avoid the contrivance, add a dedicated `api.organizations.getBySlug` query in `packages/backend/convex/organizations.ts` and use it here. Plan 4 keeps the footprint small by reusing the existing query.

- [ ] **Step 7.2: Write `apps/tenant/app/_tenant/[slug]/page.tsx`**

```tsx
import { fetchQuery } from 'convex/nextjs';
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { PostCard } from '../../../components/post-card';

async function listPosts(orgId: Id<'organizations'>) {
  'use cache';
  cacheTag(`posts:org:${orgId}`);
  cacheLife('minutes');
  return await fetchQuery(api.posts.listPublishedByOrg, { orgId });
}

export default async function TenantIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Re-resolve via the cached layout helper isn't available cross-request; refetch.
  const org = await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
  if (!org) return null;

  const posts = await listPosts(org._id);

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--color-muted-foreground)]">
        No posts yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <PostCard
          key={post._id}
          title={post.title}
          body={post.body}
          slug={post.slug}
          createdAt={post.createdAt}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 7.3: Write `apps/tenant/app/_tenant/[slug]/[postSlug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { formatPostDate } from '../../../../lib/format';

async function getPost(orgId: Id<'organizations'>, postSlug: string) {
  'use cache';
  cacheTag(`post:${orgId}:${postSlug}`);
  cacheLife('hours');
  return await fetchQuery(api.posts.getPublishedBySlug, { orgId, slug: postSlug });
}

async function resolveOrg(slug: string) {
  'use cache';
  cacheTag(`tenant:slug:${slug}`);
  cacheLife('hours');
  return await fetchQuery(api.tenant.getByHost, {
    host: `${slug}.placeholder.invalid`,
    platformRoot: 'placeholder.invalid',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const org = await resolveOrg(slug);
  if (!org) return { title: 'Not found' };
  const post = await getPost(org._id, postSlug);
  if (!post) return { title: 'Not found' };
  return {
    title: `${post.title} — ${org.name}`,
    description: post.body.slice(0, 160),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const org = await resolveOrg(slug);
  if (!org) notFound();
  const post = await getPost(org._id, postSlug);
  if (!post) notFound();

  return (
    <article className="prose prose-neutral max-w-none">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">{post.title}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {formatPostDate(post.createdAt)}
        </p>
      </header>
      <div className="whitespace-pre-wrap leading-7">{post.body}</div>
    </article>
  );
}
```

- [ ] **Step 7.4: Typecheck**

```bash
pnpm --filter tenant typecheck
```

Expected: 0-error exit.

- [ ] **Step 7.5: Commit**

```bash
git add apps/tenant/app/_tenant
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(tenant): tenant index + individual post page with cache tags"
```

---

## Task 8: Dashboard cache invalidation hooks

**Files:**
- Modify: `apps/dashboard/app/(app)/posts/actions.ts`
- Modify: `apps/dashboard/app/(app)/domains/actions.ts`

Plan 3 already calls `revalidatePath('/posts')` and `revalidatePath('/domains')` after dashboard mutations. Add `revalidateTag` for the corresponding tenant cache entries so a new post or a verified domain shows up on the public site within seconds, not at the next `cacheLife('hours')` boundary.

- [ ] **Step 8.1: Read existing `apps/dashboard/app/(app)/posts/actions.ts`**

Confirm it currently looks like:

```ts
'use server';

import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath } from 'next/cache';

export async function deletePost(id: Id<'posts'>): Promise<void> {
  await fetchMutation(api.posts.remove, { id });
  revalidatePath('/posts');
}
```

(Plan 3 Task 10 wrote this. If the implementer of Plan 3 deviated, follow what's actually in the file.)

- [ ] **Step 8.2: Add tenant-side revalidation to `deletePost`**

Replace with:

```ts
'use server';

import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function deletePost(id: Id<'posts'>): Promise<void> {
  // Read post + org BEFORE deleting so we know which tenant cache to invalidate.
  const post = await fetchQuery(api.posts.getById, { id });
  await fetchMutation(api.posts.remove, { id });
  revalidatePath('/posts');
  if (post) {
    revalidateTag(`posts:org:${post.orgId}`);
    revalidateTag(`post:${post.orgId}:${post.slug}`);
  }
}
```

- [ ] **Step 8.3: Update `posts/new/page.tsx` and `posts/[id]/edit/page.tsx` server actions**

For `new/page.tsx`'s `create` action (added in Plan 3 Task 11.2):

```ts
async function create(values: PostFormValues) {
  'use server';
  const id = await fetchMutation(api.posts.create, { ...values, orgId: org._id });
  revalidateTag(`posts:org:${org._id}`);
  return id;
}
```

For `[id]/edit/page.tsx`'s `save` action:

```ts
async function save(values: PostFormValues) {
  'use server';
  const { slug: _slug, ...patch } = values;
  await fetchMutation(api.posts.update, { id: post._id, ...patch });
  revalidateTag(`posts:org:${post.orgId}`);
  revalidateTag(`post:${post.orgId}:${post.slug}`);
}
```

(Add `import { revalidateTag } from 'next/cache';` at the top of each file.)

- [ ] **Step 8.4: Update `apps/dashboard/app/(app)/domains/actions.ts`**

After `verifyDomainAction` flips a domain to verified, invalidate both the host-keyed cache (so `proxy.ts` re-resolves) AND the slug-keyed cache. The slug entry is keyed `tenant:slug:{slug}` — we need to look up the org first.

```ts
// Inside verifyDomainAction, after the setVerified mutation succeeds:
const orgRow = await fetchQuery(api.organizations.getByWorkosId, {
  workosOrgId: 'unused-fallback', // we don't have this; bail to host-only invalidation
});
revalidateTag(`tenant:${host}`);
// Slug-side invalidation is best-effort — we don't reliably know the slug here
// without another query. The hours-long cacheLife will eventually self-heal.
```

> If you want exact invalidation, fetch the domain row before verify and read `domain.orgId` → `org.slug`. Plan 4 keeps it best-effort to avoid an extra round trip on the verify path.

- [ ] **Step 8.5: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit.

- [ ] **Step 8.6: Commit**

```bash
git add apps/dashboard/app/\(app\)/posts/actions.ts apps/dashboard/app/\(app\)/posts/new/page.tsx apps/dashboard/app/\(app\)/posts/\[id\]/edit/page.tsx apps/dashboard/app/\(app\)/domains/actions.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): revalidate tenant cache tags on post + domain mutations"
```

---

## Task 9: Tenant dev server smoke test

End-to-end verification — boot the tenant dev server, verify the seeded `acme` org renders correctly via subdomain.

- [ ] **Step 9.1: Confirm seed exists**

```bash
cd packages/backend
npx convex run debugUtils:seedTestOrg '{"slug": "acme", "name": "Acme"}'
cd ../..
```

Expected: returns the orgId (idempotent — fine if it already exists).

- [ ] **Step 9.2: Start tenant dev server**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm --filter tenant dev > /tmp/tenant-dev.log 2>&1 &
TENPID=$!
sleep 25
tail -20 /tmp/tenant-dev.log
```

Expected: log shows `Ready in <ms>` and `Local: http://localhost:3002`.

- [ ] **Step 9.3: Hit the seeded subdomain**

> Chrome and Safari resolve `*.localhost` to `127.0.0.1` automatically. If you're testing in Firefox, add `127.0.0.1 acme.localhost` to `/etc/hosts` first — or use `curl -H "Host: acme.localhost:3002"` as below.

```bash
echo "---ACME INDEX---"
curl -fsS -o /tmp/tenant-acme-index.html -w "%{http_code}\n" \
  -H "Host: acme.localhost:3002" \
  http://127.0.0.1:3002/

echo "---ACME WELCOME POST---"
curl -fsS -o /tmp/tenant-acme-welcome.html -w "%{http_code}\n" \
  -H "Host: acme.localhost:3002" \
  http://127.0.0.1:3002/welcome

echo "---APEX REDIRECT---"
curl -sS -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  -H "Host: localhost:3002" \
  http://127.0.0.1:3002/

echo "---UNKNOWN HOST---"
curl -sS -o /tmp/tenant-unknown.html -w "%{http_code}\n" \
  -H "Host: nope.example.com" \
  http://127.0.0.1:3002/

echo "---HEADER CHECKS---"
grep -q "Welcome to Acme" /tmp/tenant-acme-welcome.html && echo "post body present" || echo "MISSING post body"
grep -q "Acme" /tmp/tenant-acme-index.html && echo "header present" || echo "MISSING header"
grep -q "tenant for this domain" /tmp/tenant-unknown.html && echo "not-found message present" || echo "MISSING not-found"
```

Expected:
- Acme index: `200`, contains "Acme" header + "Welcome to Acme" card title
- Acme welcome post: `200`, contains the seeded post body
- Apex (`localhost:3002`): `308 -> http://localhost:3000`
- Unknown host: `200` rendering not-found.tsx (it's a rewrite, not a 404 status)

If any check fails, do NOT commit. Report which one and the snippet of failing output.

- [ ] **Step 9.4: Cleanup**

```bash
kill $TENPID 2>/dev/null || true
wait $TENPID 2>/dev/null || true
```

- [ ] **Step 9.5: Build verification**

```bash
pnpm --filter tenant build
```

Expected: build completes, no type or lint errors. `apps/tenant/.next/` is created.

If the build fails on `'use cache'` directive errors, the project may not have Cache Components enabled — set `experimental: { cacheComponents: true }` (if applicable for your Next.js 16.x patch) in `next.config.ts`. Adapt and report.

---

## Task 10: Full-monorepo smoke test + tag

Final verification gate — same shape as Plan 1 Task 18 + Plan 3 Task 16.

- [ ] **Step 10.1: Run all the green-checks**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm install
pnpm env:check
pnpm typecheck
pnpm lint
pnpm --filter @repo/backend test
pnpm --filter website build
pnpm --filter dashboard build
pnpm --filter tenant build
```

Expected:
- `env:check` — all four apps pass (`✓ website`, `✓ dashboard`, `✓ tenant`; `· native skip`)
- `typecheck` — successful for `@repo/backend`, `@repo/env`, `@repo/auth`, `@repo/ui`, `website`, `dashboard`, `tenant` (7 tasks)
- `lint` — green across all packages with `lint` scripts (6 tasks)
- `test` — 8 passing in `@repo/backend`
- All three Next.js builds complete cleanly

If any task fails, stop and report which one with full output.

- [ ] **Step 10.2: Tag the milestone**

```bash
git tag -a tenant-runtime-complete -m "Plan 4: tenant runtime — host routing + public posts"
```

---

## Done

When this plan completes, the repo has:

- `packages/backend/convex/debugUtils.ts` — `seedTestOrg` + `_seedTestOrgInternal` (dev-only)
- `apps/tenant/` — full Next.js 16 multi-tenant runtime at `localhost:3002`:
  - `proxy.ts` rewrites the Host header to `/_tenant/{slug}/...` internally
  - Cached host → org lookup with `tenant:{host}` tags
  - Tenant index lists published posts; individual post pages with metadata
  - Apex redirects to the marketing site; unknown hosts render not-found
- Dashboard mutations now `revalidateTag()` the relevant tenant cache entries so changes propagate within seconds
- Tag `tenant-runtime-complete` on the merge commit

## What this plan does NOT cover (deliberately)

- **Tenant-scoped auth** — the runtime is public-read only. If you need a tenant-private area (e.g. customer dashboards on a per-tenant subdomain), wire the same `@repo/auth` middleware Plan 3 uses, but configured to redirect to the *tenant's* sign-in URL not the platform's.
- **Markdown / rich-text rendering** — post bodies render as plain text with `whitespace-pre-wrap`. Plug in MDX or a sanitizer-backed HTML renderer when you have real content.
- **Redirects from old slugs** — if a tenant renames a post, the old URL 404s. Add a `redirects` table or use `next.config.ts`'s `redirects()` driven by Convex.
- **Per-tenant brand tokens** — every tenant currently uses `@repo/ui`'s default theme. To allow brand customization, add an `organizations.brandTokens` JSON column and inject CSS custom properties from the layout.
- **Real apex domain support in dev** — the apex redirect target is hardcoded to `localhost:3000`. Add `NEXT_PUBLIC_MARKETING_URL` to `tenantClientSchema` (and reference it in `proxy.ts`) before going to prod.
- **Custom 404 status for unknown hosts** — currently the unknown-host path renders a 200-status `not-found` route. Real-world setups often want a 404 to keep search indexes clean; do `notFound()` from a server component, or set `status: 404` on the rewrite response.

## What's next

**Plan 5** (`docs/superpowers/plans/plan-05-2026-05-XX-native.md`) builds `apps/native`: a bare React Native app (no Expo) with NativeWind v4 styling, WorkOS PKCE sign-in via `react-native-app-auth`, and the same Convex API consumed by the dashboard. Shares only `@repo/backend`, `@repo/env`, and design tokens (`@repo/ui/tokens`) with the web side.
