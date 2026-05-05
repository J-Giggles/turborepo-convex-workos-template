# Dashboard App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `apps/dashboard` — an AuthKit-gated Next.js 16 admin app at `localhost:3001` that lets org admins sign in with WorkOS, view post/member counts via the `postsByOrg` aggregate, do full CRUD on posts, see their org's members, and add + verify custom tenant domains via the Vercel Domains REST API.

**Architecture:** Server Components by default; small client islands wrap the Convex hooks via `ConvexProviderWithAuthKit`. `proxy.ts` (Next.js 16's renamed middleware) runs the `authkitMiddleware()` factory from `@repo/auth/middleware` to gate `(app)/*` routes. The "active org" comes straight from the AuthKit JWT's `organizationId` claim — mapped to a Convex `organizations` row via a new public `organizations.getByWorkosId` query, so the dashboard never has to maintain its own org-selection state. The Vercel REST API client lives in `apps/dashboard/lib/vercel.ts` (server-only) and is called from server actions.

**Tech Stack:** Next.js 16 App Router, React 19, `@repo/ui` (extended with input/label/textarea/select/dialog primitives), `@repo/auth`, `@repo/env/dashboard`, `@repo/backend`, `convex/react` + `convex/nextjs` (server-side fetch), `@workos-inc/authkit-nextjs` (transitively via `@repo/auth`). Existing template stack — pnpm 9, Turborepo 2, ESLint 9 flat config, Prettier 3, Tailwind v4.

**Reference spec:** `docs/superpowers/specs/2026-05-04-turborepo-convex-workos-template-design.md` (especially §6 auth flow and §10 Convex components — `aggregate` is the load-bearing piece for the home page).
**Builds on:** Plan 2 (`docs/superpowers/plans/plan-02-2026-05-05-web-shared-and-website.md`), tagged `website-and-shared-complete` on `main`.

---

## Pre-flight

- Working directory: `/home/jgigg/code/turborepo-convex-workos-template`.
- Should be executed in a worktree off `main` after Plan 2 has merged:
  ```bash
  git worktree add ../turborepo-convex-workos-template-dashboard -b plan-3-dashboard
  ```
- Convex deployment is live; placeholder WorkOS env vars are set so `convex dev` boots cleanly. **For real auth to work end-to-end you need real values** — sign up at [dashboard.workos.com](https://dashboard.workos.com), create an AuthKit project, and update via:
  ```bash
  cd packages/backend
  npx convex env set WORKOS_AUTHKIT_DOMAIN 'https://<your-tenant>.authkit.app'
  npx convex env set WORKOS_CLIENT_ID 'client_xxx'
  npx convex env set WORKOS_API_KEY 'sk_test_xxx'
  npx convex env set WORKOS_WEBHOOK_SECRET 'sk_webhook_xxx'
  ```
  In the WorkOS dashboard add `http://localhost:3001/callback` to AuthKit's allowed redirects.
- Vercel API access is **optional** for the first run — `apps/dashboard/lib/vercel.ts` no-ops gracefully when `VERCEL_API_TOKEN` is unset (the domains UI surfaces an "integration disabled" banner). Set when you're ready to test custom-domain flows:
  ```
  VERCEL_API_TOKEN= (https://vercel.com/account/tokens)
  VERCEL_TEAM_ID=
  VERCEL_PROJECT_ID_TENANT= (the tenant app project ID — from Plan 4)
  ```
- Node 20.19.4+, pnpm 9.
- Git author for all commits: `Jordan <jordan@lifepass.eu>` via `-c user.name=Jordan -c user.email=jordan@lifepass.eu`.

---

## File map

```
packages/backend/convex/
└── organizations.ts                        # NEW — public getByWorkosId query (small Plan-1 gap fill)

packages/ui/src/components/                 # extends Plan 2's button/card/badge
├── input.tsx
├── label.tsx
├── textarea.tsx
├── select.tsx
└── dialog.tsx

apps/dashboard/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.js
├── next-env.d.ts
├── env.ts                                  # createDashboardEnv() at module-load
├── proxy.ts                                # @repo/auth/middleware factory call
├── app/
│   ├── layout.tsx                          # root layout, font, metadata
│   ├── globals.css                         # imports @repo/ui/styles/globals.css
│   ├── providers.tsx                       # client — ConvexProviderWithAuthKit
│   ├── (auth)/
│   │   ├── callback/route.ts               # AuthKit return URL
│   │   └── sign-out/route.ts               # cookie clear + redirect to /
│   └── (app)/
│       ├── layout.tsx                      # auth-gated wrapper, top nav, active-org check
│       ├── page.tsx                        # dashboard home — counts via aggregate
│       ├── posts/
│       │   ├── page.tsx                    # list (server) + delete server action
│       │   ├── new/page.tsx                # create form
│       │   └── [id]/edit/page.tsx          # edit form
│       ├── members/page.tsx                # read-only member list
│       └── domains/
│           ├── page.tsx                    # list + add form
│           └── verify/route.ts             # POST handler to re-poll Vercel
├── components/
│   ├── nav.tsx                             # server — top nav with org name + sign-out
│   ├── post-form.tsx                       # client — shared by new + edit
│   ├── domain-row.tsx                      # client — verify button + status
│   └── delete-button.tsx                   # client — confirmation dialog
└── lib/
    ├── active-org.ts                       # server — readActiveOrg() helper
    └── vercel.ts                           # server — Vercel REST API wrapper
```

---

## Task 0: Backend — `organizations.getByWorkosId` public query

**Why this isn't in Plan 1:** Plan 1's `workosSync.ts` queries `organizations` internally (mutation context only). The dashboard needs a *public* query mapping a WorkOS organization id to its Convex `organizations` row, used by every authenticated request to resolve the active org. Adding it here keeps the change scoped to the consumer.

**Files:**
- Create: `packages/backend/convex/organizations.ts`

- [x] **Step 0.1: Write `packages/backend/convex/organizations.ts`**

```ts
import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';

export const getByWorkosId = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }): Promise<Doc<'organizations'> | null> => {
    return await ctx.db
      .query('organizations')
      .withIndex('by_workos_org_id', (q) => q.eq('workosOrgId', workosOrgId))
      .unique();
  },
});
```

- [x] **Step 0.2: Verify the function compiles + appears in `_generated/api.d.ts`**

Run convex dev as a background task with timeout, capture log:

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm --filter @repo/backend dev > /tmp/convex-task0.log 2>&1 &
CPID=$!
sleep 25
tail -10 /tmp/convex-task0.log
kill $CPID 2>/dev/null || true
wait $CPID 2>/dev/null || true
grep "organizations" packages/backend/convex/_generated/api.d.ts
```

Expected: clean `Functions ready!`, `import type * as organizations from "../organizations.js"` and `organizations: typeof organizations` lines appear.

- [x] **Step 0.3: Run the existing test suite**

```bash
pnpm --filter @repo/backend test
```

Expected: still 8 passing (no test regression — we added a query, not changed schema).

- [x] **Step 0.4: Commit**

```bash
git add packages/backend/convex/organizations.ts packages/backend/convex/_generated
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(backend): add organizations.getByWorkosId public query"
```

---

## Task 1: Extend `@repo/ui` with form primitives + dialog

**Files:**
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/label.tsx`
- Create: `packages/ui/src/components/textarea.tsx`
- Create: `packages/ui/src/components/select.tsx`
- Create: `packages/ui/src/components/dialog.tsx`
- Modify: `packages/ui/package.json` (add `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-dialog`)

These are the standard shadcn/ui "new-york" variants — hand-written rather than running `shadcn add` because the CLI struggles inside workspace packages (same approach as Plan 2 Task 3). The dashboard needs all five for posts/domains forms.

- [x] **Step 1.1: Add Radix primitives to `packages/ui/package.json` dependencies**

Add three new entries, keeping existing ones in alphabetic order. The `dependencies` block becomes:

```json
"dependencies": {
  "@radix-ui/react-dialog": "^1.1.4",
  "@radix-ui/react-label": "^2.1.1",
  "@radix-ui/react-select": "^2.1.4",
  "@radix-ui/react-slot": "^1.1.2",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.469.0",
  "tailwind-merge": "^2.6.0"
}
```

> If any version no longer exists on npm, substitute with the nearest current and report.

- [x] **Step 1.2: Write `packages/ui/src/components/input.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@repo/ui/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [x] **Step 1.3: Write `packages/ui/src/components/label.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@repo/ui/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;
```

- [x] **Step 1.4: Write `packages/ui/src/components/textarea.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@repo/ui/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
```

- [x] **Step 1.5: Write `packages/ui/src/components/select.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@repo/ui/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-[var(--color-input)] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-[var(--color-popover)] text-[var(--color-popover-foreground)] shadow-md',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--color-accent)] focus:text-[var(--color-accent-foreground)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
```

- [x] **Step 1.6: Write `packages/ui/src/components/dialog.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@repo/ui/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-[var(--color-background)] p-6 shadow-lg sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--color-muted-foreground)]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
```

- [x] **Step 1.7: Install + typecheck + lint**

```bash
pnpm install
pnpm --filter @repo/ui typecheck
pnpm --filter @repo/ui lint
```

Expected: 0-error exit on all three. Resolve any unused-import warnings before commit.

- [x] **Step 1.8: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(ui): add input, label, textarea, select, dialog primitives"
```

---

## Task 2: `apps/dashboard` Next.js scaffold

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/postcss.config.mjs`
- Create: `apps/dashboard/eslint.config.js`
- Create: `apps/dashboard/next-env.d.ts`

Mirrors Plan 2 Task 8 (website scaffold) but with port 3001 and dependencies on `@repo/auth`, `@repo/backend`, plus `convex` for the React provider.

- [x] **Step 2.1: Write `apps/dashboard/package.json`**

```json
{
  "name": "dashboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/auth": "workspace:*",
    "@repo/backend": "workspace:*",
    "@repo/env": "workspace:*",
    "@repo/ui": "workspace:*",
    "@workos-inc/authkit-nextjs": "^2.13.0",
    "convex": "^1.29.3",
    "lucide-react": "^0.469.0",
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

- [x] **Step 2.2: Write `apps/dashboard/tsconfig.json`**

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

- [x] **Step 2.3: Write `apps/dashboard/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui', '@repo/auth'],
};

export default config;
```

- [x] **Step 2.4: Write `apps/dashboard/postcss.config.mjs`**

```mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [x] **Step 2.5: Write `apps/dashboard/eslint.config.js`**

```js
import config from '@repo/eslint-config/nextjs';

export default config;
```

- [x] **Step 2.6: Write `apps/dashboard/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [x] **Step 2.7: Install**

```bash
pnpm install
```

Expected: workspace links resolve, `convex` and `@workos-inc/authkit-nextjs` pulled.

- [x] **Step 2.8: Commit**

```bash
git add apps/dashboard pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): scaffold Next.js 16 app shell"
```

---

## Task 3: Dashboard env validation

**Files:**
- Create: `apps/dashboard/env.ts`
- Create: `apps/dashboard/.env.local.example`

`createDashboardEnv()` is already defined in `@repo/env/dashboard` (Plan 1 Task 4). It validates server WorkOS creds + Vercel API + AuthKit client domain — see `packages/env/src/dashboard.ts`.

- [x] **Step 3.1: Write `apps/dashboard/env.ts`**

```ts
import { createDashboardEnv } from '@repo/env/dashboard';

export const env = createDashboardEnv();
```

- [x] **Step 3.2: Write `apps/dashboard/.env.local.example`**

```bash
# Required by every Next.js app to talk to Convex.
NEXT_PUBLIC_CONVEX_URL=

# Public-facing dashboard URL (metadata, invite emails).
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001

# AuthKit issuer URL — same as the value set on the Convex deployment.
NEXT_PUBLIC_AUTHKIT_DOMAIN=

# WorkOS server credentials. Server-only — NEVER prefix with NEXT_PUBLIC_.
WORKOS_CLIENT_ID=
WORKOS_API_KEY=

# Cookie session sealer (min 32 chars). Generate:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
WORKOS_COOKIE_PASSWORD=

# AuthKit redirect URI for the dashboard. Local: http://localhost:3001/callback
WORKOS_REDIRECT_URI=http://localhost:3001/callback

# Vercel REST API — needed for custom-domain provisioning.
# OPTIONAL on first run: lib/vercel.ts no-ops when VERCEL_API_TOKEN is unset
# and the domains UI shows an "integration disabled" banner.
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID_TENANT=
```

- [x] **Step 3.3: Verify `pnpm env:check` skips when `.env.local` doesn't exist**

```bash
pnpm env:check
```

Expected: `· dashboard  skip — no file at apps/dashboard/.env.local`.

- [x] **Step 3.4: Create a working `.env.local` for dev (not committed — `.gitignore` covers it)**

Replace placeholder values with real ones from your WorkOS dashboard / Convex deployment. Quick template:

```bash
cat > apps/dashboard/.env.local <<'EOF'
NEXT_PUBLIC_CONVEX_URL=<copy from packages/backend/.env.local>
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001
NEXT_PUBLIC_AUTHKIT_DOMAIN=https://placeholder.authkit.app
WORKOS_CLIENT_ID=client_placeholder
WORKOS_API_KEY=sk_placeholder
WORKOS_COOKIE_PASSWORD=00000000000000000000000000000000
WORKOS_REDIRECT_URI=http://localhost:3001/callback
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID_TENANT=
EOF
```

> All `VERCEL_*` keys must be PRESENT (they're declared as `z.string().min(1)` in the dashboard schema). For first-run dev they need *some* value — `''` is rejected, so use a single space `' '` if you really don't have a Vercel token yet, OR fill in real values. The dashboard's domains UI will read `VERCEL_API_TOKEN` and surface a banner if it's `' '` or any obviously placeholder value.
>
> **TODO during this plan:** harden `dashboard.ts` schema — relax `vercelApiSchema` from `z.string().min(1)` to `z.string().optional()` so the integration-disabled flow is real. *See Task 11 — Vercel client task — which will land both the schema relaxation and the runtime gate.*

- [x] **Step 3.5: Verify `pnpm env:check` now passes for dashboard**

```bash
pnpm env:check
```

Expected: `✓ dashboard pass`. (After Task 11, the optional VERCEL_* keys can be left blank.)

- [x] **Step 3.6: Commit**

```bash
git add apps/dashboard/env.ts apps/dashboard/.env.local.example
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add env validation + .env.local.example"
```

---

## Task 4: AuthKit `proxy.ts`

**Files:**
- Create: `apps/dashboard/proxy.ts`

Next.js 16 renamed `middleware.ts` → `proxy.ts`. The `authkitMiddleware()` factory from `@repo/auth/middleware` (Plan 2 Task 6) handles AuthKit cookie session refresh and redirects unauth'd users on protected routes.

- [x] **Step 4.1: Write `apps/dashboard/proxy.ts`**

```ts
import { authkitMiddleware } from '@repo/auth/middleware';
import type { NextRequest } from 'next/server';

const handler = authkitMiddleware({
  protectedRoutes: ['/posts/:path*', '/members/:path*', '/domains/:path*', '/'],
  signInPath: '/sign-in',
});

export default function proxy(request: NextRequest) {
  return handler(request);
}

export const config = {
  // Run on every request EXCEPT static assets, API routes that handle their own auth,
  // and the AuthKit callback (which AuthKit needs to handle without redirect interference).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|callback|sign-out).*)'],
};
```

- [x] **Step 4.2: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit. Some red flags to investigate if this fails:
- `@repo/auth/middleware` not found → `transpilePackages` in `next.config.ts` includes `@repo/auth`? Yes (Task 2.3).
- `authkitMiddleware` signature mismatch → check `packages/auth/src/middleware.ts` matches Plan 2's actual implementation.

- [x] **Step 4.3: Commit**

```bash
git add apps/dashboard/proxy.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add AuthKit proxy.ts gating protected routes"
```

---

## Task 5: ConvexProvider with AuthKit JWT

**Files:**
- Create: `apps/dashboard/app/providers.tsx`

Wraps the dashboard tree in `ConvexProviderWithAuthKit` so client components get reactive Convex queries authenticated by the AuthKit JWT. The provider lives in `app/providers.tsx` and is mounted from the root layout.

- [x] **Step 5.1: Write `apps/dashboard/app/providers.tsx`**

The Convex client lives at module scope (singleton) and `setAuth` is registered once. Convex calls the fetcher every time it needs to refresh the token — no per-render side effects, no re-runs.

```tsx
'use client';

import type { ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { env } from '../env';

const client = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

client.setAuth(async () => {
  // Returns the AuthKit access token, or null if unauthenticated.
  // The token route at /api/auth/token reads the sealed AuthKit cookie
  // (Step 5.2). Convex re-invokes this fetcher whenever it needs auth.
  try {
    const res = await fetch('/api/auth/token', { credentials: 'include' });
    if (!res.ok) return null;
    const { token } = (await res.json()) as { token: string | null };
    return token;
  } catch {
    return null;
  }
});

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
```

- [x] **Step 5.2: Write the token route at `apps/dashboard/app/api/auth/token/route.ts`**

A small server endpoint that returns the current AuthKit access token to the Convex client. AuthKit's Next.js SDK stores tokens in a sealed cookie; this route reads them server-side.

```ts
import { withAuth } from '@repo/auth/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await withAuth();
  if (!session.user || !session.accessToken) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token: session.accessToken });
}
```

> **API verification step required.** `withAuth()` in `@repo/auth/server` (Plan 2 Task 7) wraps `@workos-inc/authkit-nextjs`'s `withAuth`. Check `node_modules/@workos-inc/authkit-nextjs/dist/index.d.ts` to confirm the return shape includes `accessToken`. If not, the field may be `sealedSession` or expose tokens via a different helper — adapt and report the deviation. The intent is "return the JWT the Convex client should send".

- [x] **Step 5.3: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit.

- [x] **Step 5.4: Commit**

```bash
git add apps/dashboard/app/providers.tsx apps/dashboard/app/api
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add ConvexProvider + AuthKit token route"
```

---

## Task 6: Root layout + globals + auth-side routes

**Files:**
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/globals.css`
- Create: `apps/dashboard/app/favicon.ico` (placeholder — empty file)
- Create: `apps/dashboard/app/(auth)/callback/route.ts`
- Create: `apps/dashboard/app/(auth)/sign-out/route.ts`
- Create: `apps/dashboard/app/(auth)/sign-in/page.tsx`

The root layout pulls Geist via `next/font` (matching Plan 2's website), loads `@repo/ui/styles/globals.css`, mounts the Convex provider. The `(auth)` route group is unprotected — `proxy.ts`'s matcher excludes `/callback`, and `/sign-in` is the unauth landing.

- [x] **Step 6.1: Write `apps/dashboard/app/globals.css`**

```css
@import "@repo/ui/styles/globals.css";
```

- [x] **Step 6.2: Write `apps/dashboard/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { env } from '../env';
import { Providers } from './providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_DASHBOARD_URL),
  title: {
    default: 'Dashboard',
    template: '%s — Dashboard',
  },
  description: 'Admin control plane for the turborepo-convex-workos-template.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] **Step 6.3: Empty favicon**

```bash
touch apps/dashboard/app/favicon.ico
```

- [x] **Step 6.4: Write `apps/dashboard/app/(auth)/callback/route.ts`**

The AuthKit-supplied handler. After WorkOS redirects back from sign-in, this route exchanges the code for a session and sets the cookie.

```ts
import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth();
```

> If `handleAuth` lives at a different export path (e.g. `'@workos-inc/authkit-nextjs/dist/handleAuth'`), check the package's README or `dist/index.d.ts` and adapt. The intent is "AuthKit's official callback route handler".

- [x] **Step 6.5: Write `apps/dashboard/app/(auth)/sign-out/route.ts`**

```ts
import { signOutUrl } from '@repo/auth/server';
import { redirect } from 'next/navigation';

export async function GET() {
  await signOutUrl();
  redirect('/');
}
```

> `signOutUrl` from `@repo/auth/server` (Plan 2 Task 7) wraps `@workos-inc/authkit-nextjs`'s sign-out. If its actual signature is different — e.g. it returns a URL string vs. a server action — adjust this route accordingly: in that case, redirect to the returned URL.

- [x] **Step 6.6: Write `apps/dashboard/app/(auth)/sign-in/page.tsx`**

```tsx
import { signInUrl } from '@repo/auth/server';
import { redirect } from 'next/navigation';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnPathname?: string }>;
}) {
  const { returnPathname } = await searchParams;
  const url = await signInUrl(returnPathname);
  redirect(url);
}
```

Server-side redirect to the WorkOS-hosted sign-in page — no UI on our side, AuthKit's hosted page handles everything.

- [x] **Step 6.7: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit.

- [x] **Step 6.8: Commit**

```bash
git add apps/dashboard/app
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): root layout + Geist + auth-group routes (callback, sign-out, sign-in)"
```

---

## Task 7: Active-org server helper

**Files:**
- Create: `apps/dashboard/lib/active-org.ts`

Every authenticated request needs to resolve "which org am I acting on?". The AuthKit JWT carries the active `organizationId` claim (set when the user picks an org during AuthKit sign-in). We map it to the Convex `organizations` row via the new `organizations.getByWorkosId` query (Task 0).

- [x] **Step 7.1: Write `apps/dashboard/lib/active-org.ts`**

```ts
import 'server-only';
import { withAuth } from '@repo/auth/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Doc } from '@repo/backend/_generated/dataModel';
import { redirect } from 'next/navigation';

export type ActiveOrg = {
  user: { id: string; email: string; name: string | null };
  org: Doc<'organizations'>;
};

/**
 * Resolves the user + their active organization. Use in `(app)/*` server
 * components — `proxy.ts` already gated the route, so unauthenticated requests
 * never reach this. Failures here are about an unsynced organization or a
 * missing JWT claim.
 */
export async function readActiveOrg(): Promise<ActiveOrg> {
  const session = await withAuth({ ensureSignedIn: true });

  if (!session.organizationId) {
    // User has no organization. AuthKit's create-org flow handles this; we
    // bounce them there.
    redirect('/sign-in?reason=no-org');
  }

  const org = await fetchQuery(api.organizations.getByWorkosId, {
    workosOrgId: session.organizationId,
  });

  if (!org) {
    // Org exists in WorkOS but the webhook hasn't synced yet. Surface a
    // human-readable error rather than a 500. Real apps might retry with a
    // brief delay; the template just throws.
    throw new Error(
      `Organization ${session.organizationId} is not yet synced from WorkOS. ` +
        'Try again in a few seconds.',
    );
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.firstName
        ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ''}`
        : null,
    },
    org,
  };
}
```

> **API verification:** `session.organizationId`, `session.user.id/email/firstName/lastName` — names depend on AuthKit's session shape. Check `node_modules/@workos-inc/authkit-nextjs/dist/index.d.ts` and adapt. Same caveat as Task 5/6: deviations are likely; report any.

- [x] **Step 7.2: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit. If `@repo/backend/_generated/dataModel` import path is wrong, check `packages/backend/package.json` exports — Plan 1 ships only `.` and `./schema` — the dataModel import may need `import type { Doc } from '@repo/backend';` if `Doc` is re-exported from `_generated/api`. Adapt and report.

- [x] **Step 7.3: Commit**

```bash
git add apps/dashboard/lib/active-org.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add readActiveOrg() server helper"
```

---

## Task 8: Auth-gated layout + top nav

**Files:**
- Create: `apps/dashboard/app/(app)/layout.tsx`
- Create: `apps/dashboard/components/nav.tsx`

The `(app)` route group is everything that requires auth. Its layout reads the active org once and passes the org name to the nav. Nav has two links (Posts, Members, Domains) and a sign-out button.

- [x] **Step 8.1: Write `apps/dashboard/components/nav.tsx`**

```tsx
import Link from 'next/link';
import { Button } from '@repo/ui/components/button';

export function Nav({ orgName, userEmail }: { orgName: string; userEmail: string }) {
  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            {orgName}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--color-muted-foreground)]">
            <Link className="hover:text-[var(--color-foreground)]" href="/posts">
              Posts
            </Link>
            <Link className="hover:text-[var(--color-foreground)]" href="/members">
              Members
            </Link>
            <Link className="hover:text-[var(--color-foreground)]" href="/domains">
              Domains
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--color-muted-foreground)]">{userEmail}</span>
          <Button variant="outline" size="sm" asChild>
            <a href="/sign-out">Sign out</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [x] **Step 8.2: Write `apps/dashboard/app/(app)/layout.tsx`**

```tsx
import { readActiveOrg } from '../../lib/active-org';
import { Nav } from '../../components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await readActiveOrg();
  return (
    <div className="min-h-screen">
      <Nav orgName={org.name} userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
```

- [x] **Step 8.3: Typecheck + lint**

```bash
pnpm --filter dashboard typecheck && pnpm --filter dashboard lint
```

Expected: 0-error exit on both.

- [x] **Step 8.4: Commit**

```bash
git add apps/dashboard/components/nav.tsx apps/dashboard/app/\(app\)/layout.tsx
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add auth-gated (app) layout with top nav"
```

---

## Task 9: Dashboard home page — counts via aggregate

**Files:**
- Create: `apps/dashboard/app/(app)/page.tsx`

The home page reads two counts:

- Posts in the active org via `api.posts.countByOrg` (uses the `postsByOrg` aggregate from Plan 1 Task 15).
- Members in the active org — use `ctx.db.query('members').withIndex('by_org_id').collect().length`. There's no dedicated count function yet, so we add a small `members.countByOrg` query as part of this task.

- [x] **Step 9.1: Add `members.countByOrg` to backend**

Create `packages/backend/convex/members.ts`:

```ts
import { v } from 'convex/values';
import { query } from './_generated/server';

export const countByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const rows = await ctx.db
      .query('members')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
    return rows.length;
  },
});

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const members = await ctx.db
      .query('members')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
    // Resolve member -> user for the list page in Task 12.
    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', m.workosUserId))
          .unique();
        return { member: m, user };
      }),
    );
  },
});
```

Verify codegen picks it up (background convex dev with timeout — same pattern as Task 0.2).

- [x] **Step 9.2: Write `apps/dashboard/app/(app)/page.tsx`**

```tsx
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';
import { readActiveOrg } from '../../lib/active-org';

export default async function HomePage() {
  const { org } = await readActiveOrg();
  const [postCount, memberCount] = await Promise.all([
    fetchQuery(api.posts.countByOrg, { orgId: org._id }),
    fetchQuery(api.members.countByOrg, { orgId: org._id }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {org.name}</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          A snapshot of your organization.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Posts</CardDescription>
            <CardTitle className="text-4xl">{postCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-4xl">{memberCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
```

- [x] **Step 9.3: Typecheck**

```bash
pnpm --filter dashboard typecheck && pnpm --filter @repo/backend test
```

Expected: 0-error typecheck. Tests still 8 passing.

- [x] **Step 9.4: Commit**

```bash
git add packages/backend/convex/members.ts packages/backend/convex/_generated apps/dashboard/app/\(app\)/page.tsx
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): home page with post + member counts"
```

---

## Task 10: Posts list + delete server action

**Files:**
- Create: `apps/dashboard/app/(app)/posts/page.tsx`
- Create: `apps/dashboard/components/delete-button.tsx`

Posts list reads `api.posts.listAllByOrg` (auth-gated query; the AuthKit JWT in the Convex client identifies the user, and `requireOrgMembership` validates membership server-side). Delete uses a server action wrapper around `api.posts.remove`.

- [x] **Step 10.1: Write `apps/dashboard/components/delete-button.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog';

export function DeleteButton({
  action,
  itemLabel,
}: {
  action: () => Promise<void>;
  itemLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {itemLabel}?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await action();
                setOpen(false);
              });
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 10.2: Write `apps/dashboard/app/(app)/posts/page.tsx`**

```tsx
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { Button } from '@repo/ui/components/button';
import { Badge } from '@repo/ui/components/badge';
import { readActiveOrg } from '../../../lib/active-org';
import { DeleteButton } from '../../../components/delete-button';
import { deletePost } from './actions';

export default async function PostsPage() {
  const { org } = await readActiveOrg();
  const posts = await fetchQuery(api.posts.listAllByOrg, { orgId: org._id });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <Button asChild>
          <Link href="/posts/new">New post</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-muted-foreground)]">
          No posts yet. <Link className="underline" href="/posts/new">Create your first.</Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--color-muted)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post._id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{post.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {post.slug}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={post.published ? 'default' : 'secondary'}>
                      {post.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="flex justify-end gap-1 px-4 py-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/posts/${post._id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteButton
                      itemLabel={`post "${post.title}"`}
                      action={async () => {
                        'use server';
                        await deletePost(post._id as Id<'posts'>);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 10.3: Write `apps/dashboard/app/(app)/posts/actions.ts`**

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

> `fetchMutation` from `convex/nextjs` propagates the AuthKit JWT to Convex automatically when the request flows through the Convex provider's auth setter (Task 5). For server-action paths Convex passes the cookie session directly to the deployment via `Convex-Auth` header. If you see "Not authenticated" errors, confirm `fetchMutation` is being called inside an authenticated request lifecycle.

- [x] **Step 10.4: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit.

- [x] **Step 10.5: Commit**

```bash
git add apps/dashboard/app/\(app\)/posts apps/dashboard/components/delete-button.tsx
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): posts list + delete dialog"
```

---

## Task 11: Posts create + edit (shared form)

**Files:**
- Create: `apps/dashboard/components/post-form.tsx`
- Create: `apps/dashboard/app/(app)/posts/new/page.tsx`
- Create: `apps/dashboard/app/(app)/posts/[id]/edit/page.tsx`

One client form component reused by `/posts/new` and `/posts/[id]/edit`. Submit flows through server actions that call `api.posts.create` / `api.posts.update`.

- [x] **Step 11.1: Write `apps/dashboard/components/post-form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Textarea } from '@repo/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';

export type PostFormValues = {
  title: string;
  slug: string;
  body: string;
  published: boolean;
};

export function PostForm({
  initialValues,
  action,
  submitLabel,
}: {
  initialValues: PostFormValues;
  action: (values: PostFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await action(values);
            router.push('/posts');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
          }
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          required
          pattern="[a-z0-9-]+"
          value={values.slug}
          onChange={(e) => setValues({ ...values, slug: e.target.value })}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Lowercase letters, digits, and hyphens. Used as the URL path on the tenant site.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          required
          rows={10}
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={values.published ? 'published' : 'draft'}
          onValueChange={(v) => setValues({ ...values, published: v === 'published' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/posts')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

- [x] **Step 11.2: Write `apps/dashboard/app/(app)/posts/new/page.tsx`**

```tsx
import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import { PostForm, type PostFormValues } from '../../../../components/post-form';
import { readActiveOrg } from '../../../../lib/active-org';

export default async function NewPostPage() {
  const { org } = await readActiveOrg();

  async function create(values: PostFormValues) {
    'use server';
    await fetchMutation(api.posts.create, { ...values, orgId: org._id });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">New post</h1>
      <PostForm
        initialValues={{ title: '', slug: '', body: '', published: false }}
        submitLabel="Create"
        action={create}
      />
    </div>
  );
}
```

- [x] **Step 11.3: Write `apps/dashboard/app/(app)/posts/[id]/edit/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { PostForm, type PostFormValues } from '../../../../../components/post-form';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await fetchQuery(api.posts.getById, { id: id as Id<'posts'> });
  if (!post) notFound();

  async function save(values: PostFormValues) {
    'use server';
    const { slug: _slug, ...patch } = values;
    await fetchMutation(api.posts.update, { id: post._id, ...patch });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Edit post</h1>
      <PostForm
        initialValues={{
          title: post.title,
          slug: post.slug,
          body: post.body,
          published: post.published,
        }}
        submitLabel="Save"
        action={save}
      />
    </div>
  );
}
```

> `api.posts.getById` doesn't exist in Plan 1 — `posts.update` accepts an `Id<'posts'>` but there's no public read-by-id helper. **Add it as part of this task** in `packages/backend/convex/posts.ts`:
>
> ```ts
> export const getById = query({
>   args: { id: v.id('posts') },
>   handler: async (ctx, { id }) => {
>     const post = await ctx.db.get(id);
>     if (!post) return null;
>     await requireOrgMembership(ctx, post.orgId);
>     return post;
>   },
> });
> ```
>
> (Append next to the other `posts.ts` exports. Membership check protects against another org's user fetching by id.)

- [x] **Step 11.4: Add `api.posts.getById`**

In `packages/backend/convex/posts.ts`, append (next to the other queries):

```ts
export const getById = query({
  args: { id: v.id('posts') },
  handler: async (ctx, { id }) => {
    const post = await ctx.db.get(id);
    if (!post) return null;
    await requireOrgMembership(ctx, post.orgId);
    return post;
  },
});
```

Run convex dev briefly to regenerate `_generated/api.d.ts` (background-task pattern, 25s timeout).

- [x] **Step 11.5: Typecheck**

```bash
pnpm --filter dashboard typecheck && pnpm --filter @repo/backend test
```

Expected: 0-error typecheck. Tests still 8 passing.

- [x] **Step 11.6: Commit**

```bash
git add packages/backend/convex/posts.ts packages/backend/convex/_generated apps/dashboard/components/post-form.tsx apps/dashboard/app/\(app\)/posts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): posts create + edit shared form, add posts.getById"
```

---

## Task 12: Members list page

**Files:**
- Create: `apps/dashboard/app/(app)/members/page.tsx`

Read-only list of org members with their email + role. The `members.listByOrg` query was added in Task 9.

- [x] **Step 12.1: Write `apps/dashboard/app/(app)/members/page.tsx`**

```tsx
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Badge } from '@repo/ui/components/badge';
import { readActiveOrg } from '../../../lib/active-org';

export default async function MembersPage() {
  const { org } = await readActiveOrg();
  const rows = await fetchQuery(api.members.listByOrg, { orgId: org._id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Synced from WorkOS. To invite or remove members, use your{' '}
          <a className="underline" href="https://dashboard.workos.com" target="_blank" rel="noreferrer">
            WorkOS dashboard
          </a>
          .
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--color-muted)] text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, user }) => (
              <tr key={member._id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{user?.email ?? '(unsynced user)'}</td>
                <td className="px-4 py-2">{user?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [x] **Step 12.2: Typecheck**

```bash
pnpm --filter dashboard typecheck
```

Expected: 0-error exit.

- [x] **Step 12.3: Commit**

```bash
git add apps/dashboard/app/\(app\)/members
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): read-only members list"
```

---

## Task 13: Vercel REST API client + dashboard env relaxation

**Files:**
- Create: `apps/dashboard/lib/vercel.ts`
- Modify: `packages/env/src/dashboard.ts` (relax `vercelApiSchema` to optional)

The Vercel client wraps three endpoints: `add domain to project`, `verify domain`, `remove domain`. When `VERCEL_API_TOKEN` is unset, every method returns `{ disabled: true }` — the UI surfaces a banner instead of breaking. This makes `VERCEL_*` keys truly optional in dev.

- [x] **Step 13.1: Relax `vercelApiSchema` in `packages/env/src/dashboard.ts`**

Find the import + spread:

```ts
import {
  authkitClientSchema,
  convexClientSchema,
  vercelApiSchema,
  workosServerSchema,
  workosSessionSchema,
} from './serverShared';

export const dashboardServerSchema = {
  ...workosServerSchema,
  ...workosSessionSchema,
  ...vercelApiSchema,
} as const;
```

`vercelApiSchema` in `packages/env/src/serverShared.ts` is currently:

```ts
export const vercelApiSchema = {
  VERCEL_API_TOKEN: z.string().min(1),
  VERCEL_TEAM_ID: z.string().min(1),
  VERCEL_PROJECT_ID_TENANT: z.string().min(1),
} as const;
```

Change every `.min(1)` to `.optional()`:

```ts
export const vercelApiSchema = {
  VERCEL_API_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID_TENANT: z.string().optional(),
} as const;
```

- [x] **Step 13.2: Write `apps/dashboard/lib/vercel.ts`**

```ts
import 'server-only';
import { env } from '../env';

const VERCEL_API = 'https://api.vercel.com';

export type DomainConfig = {
  name: string;
  apexName: string;
  projectId: string;
  redirect: string | null;
  redirectStatusCode: number | null;
  gitBranch: string | null;
  updatedAt: number;
  createdAt: number;
  verified: boolean;
};

type Disabled = { disabled: true };
type Ok<T> = { disabled: false; data: T };
type Result<T> = Disabled | Ok<T>;

function isEnabled(): boolean {
  return Boolean(env.VERCEL_API_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID_TENANT);
}

function teamQuery(): string {
  return env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  if (!isEnabled()) return { disabled: true };
  const res = await fetch(`${VERCEL_API}${path}${teamQuery()}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel ${method} ${path} failed: ${res.status} ${text}`);
  }
  return { disabled: false, data: (await res.json()) as T };
}

export async function addDomain(name: string): Promise<Result<DomainConfig>> {
  return call('POST', `/v10/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains`, { name });
}

export async function verifyDomain(name: string): Promise<Result<DomainConfig>> {
  return call(
    'POST',
    `/v9/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains/${encodeURIComponent(name)}/verify`,
  );
}

export async function removeDomain(name: string): Promise<Result<{ uid: string }>> {
  return call(
    'DELETE',
    `/v9/projects/${env.VERCEL_PROJECT_ID_TENANT}/domains/${encodeURIComponent(name)}`,
  );
}

export const vercelEnabled = isEnabled;
```

> Vercel REST API URL versions (`/v9`, `/v10`) come from current Vercel docs. If the response shape differs in 2026 (the API has been stable since 2023), surface the deviation but keep the function signatures.

- [x] **Step 13.3: Typecheck both packages**

```bash
pnpm --filter @repo/env typecheck && pnpm --filter dashboard typecheck
```

Expected: 0-error exit on both.

- [x] **Step 13.4: Verify env:check still passes for dashboard with empty VERCEL_***

Edit `apps/dashboard/.env.local` to leave `VERCEL_*` blank, then:

```bash
pnpm env:check
```

Expected: `✓ dashboard pass`. (Previously failed because `.min(1)` rejected blank values.)

- [x] **Step 13.5: Commit**

```bash
git add packages/env/src/serverShared.ts apps/dashboard/lib/vercel.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): add Vercel REST client + relax VERCEL_* schema to optional"
```

---

## Task 14: Domains UI — list, add, verify

**Files:**
- Create: `apps/dashboard/app/(app)/domains/page.tsx`
- Create: `apps/dashboard/app/(app)/domains/actions.ts`
- Create: `apps/dashboard/app/(app)/domains/verify/route.ts`
- Create: `apps/dashboard/components/domain-row.tsx`
- Modify: `packages/backend/convex/domains.ts` (NEW — add CRUD mutations + list query)

The dashboard's domains page reads `api.domains.listByOrg` from Convex (NEW — Plan 1 didn't include this), shows each row with verification status, and an "Add domain" form. Adding a domain (a) calls Vercel's `POST /domains`, (b) inserts a Convex `domains` row tagged unverified, and (c) starts a polling cron via `verifyDomains` (already wired in Plan 1 Task 14).

- [ ] **Step 14.1: Add domains backend functions in `packages/backend/convex/domains.ts`**

```ts
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireOrgMembership } from './_helpers/auth';

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    await requireOrgMembership(ctx, orgId);
    return await ctx.db
      .query('domains')
      .withIndex('by_org_id', (q) => q.eq('orgId', orgId))
      .collect();
  },
});

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    host: v.string(),
    isPrimary: v.boolean(),
    vercelConfigId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireOrgMembership(ctx, args.orgId);
    const lowercaseHost = args.host.toLowerCase();
    const existing = await ctx.db
      .query('domains')
      .withIndex('by_host', (q) => q.eq('host', lowercaseHost))
      .unique();
    if (existing) throw new Error('That domain is already registered.');
    return await ctx.db.insert('domains', {
      ...args,
      host: lowercaseHost,
      verified: false,
    });
  },
});

export const setVerified = mutation({
  args: { id: v.id('domains'), verified: v.boolean() },
  handler: async (ctx, { id, verified }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await requireOrgMembership(ctx, existing.orgId);
    await ctx.db.patch(id, { verified });
  },
});

export const remove = mutation({
  args: { id: v.id('domains') },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await requireOrgMembership(ctx, existing.orgId);
    await ctx.db.delete(id);
  },
});
```

Run convex dev (background-task pattern) to regenerate codegen.

- [ ] **Step 14.2: Write `apps/dashboard/components/domain-row.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@repo/ui/components/button';
import { Badge } from '@repo/ui/components/badge';

export function DomainRow({
  host,
  verified,
  onVerify,
  onRemove,
}: {
  host: string;
  verified: boolean;
  onVerify: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [isVerifying, startVerify] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 font-mono text-sm">{host}</td>
      <td className="px-4 py-2">
        <Badge variant={verified ? 'default' : 'secondary'}>
          {verified ? 'Verified' : 'Pending'}
        </Badge>
      </td>
      <td className="flex justify-end gap-1 px-4 py-2">
        {!verified && (
          <Button
            variant="outline"
            size="sm"
            disabled={isVerifying}
            onClick={() => {
              setError(null);
              startVerify(async () => {
                try {
                  await onVerify();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Verify failed.');
                }
              });
            }}
          >
            {isVerifying ? 'Checking…' : 'Verify'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={isRemoving}
          onClick={() => {
            setError(null);
            startRemove(async () => {
              try {
                await onRemove();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Remove failed.');
              }
            });
          }}
        >
          {isRemoving ? 'Removing…' : 'Remove'}
        </Button>
        {error && (
          <span className="self-center text-xs text-[var(--color-destructive)]">{error}</span>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 14.3: Write `apps/dashboard/app/(app)/domains/actions.ts`**

```ts
'use server';

import { fetchMutation } from 'convex/nextjs';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';
import { revalidatePath } from 'next/cache';
import { addDomain, verifyDomain, removeDomain, vercelEnabled } from '../../../lib/vercel';

export async function createDomain(formData: FormData) {
  const orgId = formData.get('orgId') as Id<'organizations'>;
  const host = String(formData.get('host') ?? '').trim().toLowerCase();
  if (!host) throw new Error('Host is required.');

  const vercelResult = vercelEnabled() ? await addDomain(host) : { disabled: true as const };
  const configId = vercelResult.disabled ? null : (vercelResult.data as { name: string }).name;

  await fetchMutation(api.domains.create, { orgId, host, isPrimary: false, vercelConfigId: configId });
  revalidatePath('/domains');
}

export async function verifyDomainAction(domainId: Id<'domains'>, host: string) {
  if (!vercelEnabled()) {
    throw new Error('Vercel API not configured. Set VERCEL_API_TOKEN to enable verification.');
  }
  const result = await verifyDomain(host);
  if (!result.disabled && result.data.verified) {
    await fetchMutation(api.domains.setVerified, { id: domainId, verified: true });
  }
  revalidatePath('/domains');
}

export async function removeDomainAction(domainId: Id<'domains'>, host: string) {
  if (vercelEnabled()) {
    try {
      await removeDomain(host);
    } catch {
      // Vercel may have already removed it; continue with local delete.
    }
  }
  await fetchMutation(api.domains.remove, { id: domainId });
  revalidatePath('/domains');
}
```

- [ ] **Step 14.4: Write `apps/dashboard/app/(app)/domains/page.tsx`**

```tsx
import { fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { readActiveOrg } from '../../../lib/active-org';
import { DomainRow } from '../../../components/domain-row';
import { vercelEnabled } from '../../../lib/vercel';
import { createDomain, removeDomainAction, verifyDomainAction } from './actions';

export default async function DomainsPage() {
  const { org } = await readActiveOrg();
  const domains = await fetchQuery(api.domains.listByOrg, { orgId: org._id });
  const enabled = vercelEnabled();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
      </div>

      {!enabled && (
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
          <strong className="text-[var(--color-foreground)]">Vercel integration disabled.</strong>{' '}
          Set <code>VERCEL_API_TOKEN</code>, <code>VERCEL_TEAM_ID</code>, and{' '}
          <code>VERCEL_PROJECT_ID_TENANT</code> in <code>apps/dashboard/.env.local</code> to add and
          verify custom domains.
        </div>
      )}

      <form action={createDomain} className="flex items-end gap-2 rounded-md border p-4">
        <input type="hidden" name="orgId" value={org._id} />
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="host">Add a custom domain</Label>
          <Input
            id="host"
            name="host"
            type="text"
            required
            placeholder="app.acmecorp.com"
            disabled={!enabled}
          />
        </div>
        <Button type="submit" disabled={!enabled}>
          Add
        </Button>
      </form>

      {domains.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-[var(--color-muted-foreground)]">
          No custom domains yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--color-muted)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Host</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <DomainRow
                  key={domain._id}
                  host={domain.host}
                  verified={domain.verified}
                  onVerify={async () => {
                    'use server';
                    await verifyDomainAction(domain._id, domain.host);
                  }}
                  onRemove={async () => {
                    'use server';
                    await removeDomainAction(domain._id, domain.host);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 14.5: Write `apps/dashboard/app/(app)/domains/verify/route.ts`**

A POST endpoint the cron job (Plan 1 Task 14's `verifyDomains`) can target — re-polls Vercel for every unverified domain across the deployment.

```ts
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@repo/backend';
import { verifyDomain, vercelEnabled } from '../../../../lib/vercel';
import { NextResponse } from 'next/server';

export async function POST() {
  if (!vercelEnabled()) {
    return NextResponse.json({ disabled: true }, { status: 200 });
  }

  // NOTE: this endpoint is unauthenticated for cron access. In production, gate
  // it with a shared secret in a header or run the polling loop directly inside
  // the Convex cron's internalAction (no HTTP hop). The template uses a route
  // handler so the cron can run on Vercel's free tier.
  const orgs = await fetchQuery(api.organizations.list, {});
  const results: Array<{ host: string; verified: boolean }> = [];

  for (const org of orgs) {
    const domains = await fetchQuery(api.domains.listByOrg, { orgId: org._id });
    for (const d of domains) {
      if (d.verified) continue;
      try {
        const r = await verifyDomain(d.host);
        if (!r.disabled && r.data.verified) {
          await fetchMutation(api.domains.setVerified, { id: d._id, verified: true });
          results.push({ host: d.host, verified: true });
        } else {
          results.push({ host: d.host, verified: false });
        }
      } catch (err) {
        results.push({ host: d.host, verified: false });
        console.error(`verify ${d.host} failed:`, err);
      }
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
```

> This route hits two backend functions that don't exist yet: `api.organizations.list` (full org list) and `api.domains.listByOrg` (added in Step 14.1). Add `organizations.list` to `packages/backend/convex/organizations.ts`:
>
> ```ts
> export const list = query({
>   args: {},
>   handler: async (ctx) => await ctx.db.query('organizations').collect(),
> });
> ```
>
> The cron's call to this endpoint should be guarded — for the template, leave it unauthenticated and document the expectation. *Real apps should use a shared secret.*

- [ ] **Step 14.6: Add `organizations.list` to backend**

In `packages/backend/convex/organizations.ts`, append:

```ts
export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query('organizations').collect(),
});
```

Run convex dev briefly to regenerate.

- [ ] **Step 14.7: Typecheck + lint**

```bash
pnpm --filter dashboard typecheck && pnpm --filter dashboard lint
pnpm --filter @repo/backend typecheck && pnpm --filter @repo/backend test
```

Expected: 0-error exits. Tests still 8 passing.

- [ ] **Step 14.8: Commit**

```bash
git add packages/backend/convex/domains.ts packages/backend/convex/organizations.ts packages/backend/convex/_generated apps/dashboard/app/\(app\)/domains apps/dashboard/components/domain-row.tsx
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(dashboard): domains list, add, verify, remove + Vercel-disabled banner"
```

---

## Task 15: Dashboard dev server smoke test

After all per-task work, boot the dev server end-to-end and confirm the unauthenticated user is redirected to AuthKit.

- [ ] **Step 15.1: Start dev server in background**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm --filter dashboard dev > /tmp/dashboard-dev.log 2>&1 &
DASHPID=$!
sleep 25
tail -25 /tmp/dashboard-dev.log
```

Expected: log shows `Ready in <ms>` and `Local: http://localhost:3001`.

- [ ] **Step 15.2: HTTP smoke test**

```bash
echo "---HOMEPAGE (unauthenticated)---"
curl -fsS -o /tmp/dash-home.html -w "%{http_code}\n" -L --max-redirs 0 http://localhost:3001/ || echo "expected redirect"

echo "---SIGN-IN ROUTE---"
curl -fsS -o /tmp/dash-signin.html -w "%{http_code}\n" -L --max-redirs 0 http://localhost:3001/sign-in || echo "expected redirect to AuthKit"
```

Expected:
- `/` returns a 307/302 redirect to `/sign-in?returnPathname=/`. (Without real WorkOS env, the redirect chain may end at an error page — that's fine for smoke; we're proving the proxy.ts gate fires.)
- `/sign-in` returns a 307/302 redirect to a WorkOS-hosted URL.

- [ ] **Step 15.3: Cleanup**

```bash
kill $DASHPID 2>/dev/null || true
wait $DASHPID 2>/dev/null || true
```

- [ ] **Step 15.4: Build verification**

```bash
pnpm --filter dashboard build
```

Expected: build completes, no type or lint errors. `apps/dashboard/.next/` is created.

If the build fails on `withAuth` / `useAuth` API mismatches: that means Plan 2's `@repo/auth` was scaffolded against an outdated AuthKit shape. Revisit `node_modules/@workos-inc/authkit-nextjs/dist/index.d.ts` and adapt either `@repo/auth` or this plan's API references — report any deviations.

---

## Task 16: Full-monorepo smoke test + tag

Final verification gate. Same shape as Plan 1 Task 18.

- [ ] **Step 16.1: Run all the green-checks**

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm install
pnpm env:check
pnpm typecheck
pnpm lint
pnpm --filter @repo/backend test
pnpm --filter dashboard build
pnpm --filter website build
```

Expected:
- `env:check` — `✓ website pass`, `✓ dashboard pass`, others skip
- `typecheck` — successful for `@repo/backend`, `@repo/env`, `@repo/auth`, `@repo/ui`, `website`, `dashboard` (6 tasks)
- `lint` — green across all packages with `lint` scripts (5 tasks)
- `test` — 8 passing in `@repo/backend`
- Both Next.js builds complete cleanly

If any task fails, stop and report which one with full output.

- [ ] **Step 16.2: Tag the milestone**

```bash
git tag -a dashboard-complete -m "Plan 3: dashboard with posts/members/domains UI"
```

---

## Done

When this plan completes, the repo has:

- `packages/backend/convex/organizations.ts` — public `getByWorkosId` + `list` queries
- `packages/backend/convex/members.ts` — `countByOrg` + `listByOrg`
- `packages/backend/convex/domains.ts` — `listByOrg` + `create` + `setVerified` + `remove`
- `packages/backend/convex/posts.ts` — extended with `getById`
- `packages/ui/src/components/{input,label,textarea,select,dialog}.tsx` — 5 new shadcn primitives
- `apps/dashboard/` — full Next.js 16 app at `localhost:3001` with:
  - AuthKit `proxy.ts` gate
  - ConvexProvider with AuthKit JWT
  - Active-org server helper
  - Auth-gated `(app)` group: home (counts), posts CRUD, members list, domains UI
  - Sign-in / callback / sign-out routes
  - Vercel REST API client with env-gated fall-through
- Tag `dashboard-complete` on the merge commit

## What this plan does NOT cover (deliberately)

- **Org switching** — the dashboard reads the user's currently-active WorkOS org. Multi-org users switch via WorkOS's hosted org-picker; we don't add a custom switcher UI.
- **Real-time updates** — list pages use `fetchQuery` (server-side) rather than `useQuery` (live). Reactive UI is a follow-up; for the template's purposes, server-fetched + `revalidatePath` after mutations is sufficient.
- **Member invitation** — adding/removing members happens in the WorkOS dashboard. Our members list is read-only.
- **Domain DNS instructions** — the UI shows verified/pending; it doesn't print the CNAME records the user needs to set on their DNS. Add this in a follow-up by reading Vercel's `verification` array on the domain config.
- **Custom error UI** — falls back to Next.js defaults.

## What's next

**Plan 4** (`docs/superpowers/plans/plan-04-2026-05-05-tenant-runtime.md`) builds `apps/tenant`: the multi-tenant Next.js 16 app at port 3002 that resolves `{slug}.localhost:3002` and `app.acmecorp.com`-style custom domains via `proxy.ts` host routing, then renders public posts via `api.posts.listPublishedByHost` (with the rate-limiter caveat already documented in Plan 1).
