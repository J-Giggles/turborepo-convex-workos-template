# Web Shared Packages + Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@repo/ui` (shadcn/ui + Tailwind v4 preset + design tokens), `@repo/auth` (WorkOS AuthKit Next.js wrapper), and `apps/website` (a Next.js 16 marketing site) so a forker has working brand-able pages and reusable UI/auth packages ready for the dashboard and tenant app to consume.

**Architecture:** `@repo/ui` is the single source of truth for visual primitives — shadcn/ui components live in `packages/ui/src/components/`, Tailwind v4 theme tokens in `packages/ui/src/styles/`, and a small `tokens.ts` mirror is exported for the native side (Plan 5). `@repo/auth` wraps `@workos-inc/authkit-nextjs` so dashboard + tenant apps don't repeat session/middleware boilerplate. `apps/website` is a public, ISR-friendly Next.js 16 app that imports `@repo/ui` styles + components and validates env at boot via `createWebsiteEnv()` from `@repo/env/website`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui (latest CLI, registry: `@shadcn-ui/registry`), `@workos-inc/authkit-nextjs`, `next/font` (Geist), `next/image`. Existing template stack — pnpm 9, Turborepo 2, ESLint 9 flat config, Prettier 3.

**Reference spec:** `docs/superpowers/specs/2026-05-04-turborepo-convex-workos-template-design.md`
**Builds on:** Plan 1 (`docs/superpowers/plans/2026-05-04-foundation-and-backend.md`), tagged `foundation-and-backend-complete` on `main`.

---

## Pre-flight

- Working directory: `/home/jgigg/code/turborepo-convex-workos-template`.
- Should be executed in a worktree off `main`:
  ```bash
  git worktree add ../turborepo-convex-workos-template-website -b plan-2-website-and-shared
  ```
- Convex backend is already deployed; placeholders set for WORKOS_*. `pnpm dev`/`pnpm env:check` work.
- Node 20.19.4+, pnpm 9.
- Git author for all commits: `Jordan <jordan@lifepass.eu>` via `-c user.name=Jordan -c user.email=jordan@lifepass.eu`.

---

## File map (what each new file is responsible for)

```
packages/ui/
├── package.json                         # @repo/ui — exports map, shadcn deps
├── tsconfig.json                        # extends @repo/typescript-config/react-library
├── eslint.config.js                     # re-exports @repo/eslint-config/react-internal
├── components.json                      # shadcn CLI config — points at src/components
├── postcss.config.mjs                   # @tailwindcss/postcss for downstream consumers
├── src/
│   ├── styles/
│   │   └── globals.css                  # Tailwind v4 import + @theme tokens (single source)
│   ├── lib/
│   │   └── utils.ts                     # shadcn cn() helper
│   ├── components/
│   │   ├── button.tsx                   # shadcn primitive
│   │   ├── card.tsx                     # shadcn primitive
│   │   └── badge.tsx                    # shadcn primitive
│   └── tokens.ts                        # design-token mirror for the native side

packages/auth/
├── package.json                         # @repo/auth
├── tsconfig.json                        # node preset
├── eslint.config.js                     # base config
└── src/
    ├── index.ts                         # barrel export
    ├── middleware.ts                    # authkitMiddleware() factory for proxy.ts
    └── server.ts                        # withAuth(), signInUrl(), signOutUrl()

apps/website/
├── package.json                         # website app
├── tsconfig.json                        # extends @repo/typescript-config/nextjs
├── eslint.config.js                     # nextjs config
├── next.config.ts                       # Next.js config
├── postcss.config.mjs                   # imports @repo/ui's
├── env.ts                               # createWebsiteEnv() at module-load
├── app/
│   ├── layout.tsx                       # root layout, font, metadata
│   ├── page.tsx                         # landing
│   ├── globals.css                      # imports @repo/ui/styles/globals.css
│   └── favicon.ico                      # placeholder
└── components/
    └── landing/
        ├── hero.tsx
        ├── features.tsx
        └── footer.tsx
```

---

## Task 1: `@repo/ui` package skeleton

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/eslint.config.js`
- Create: `packages/ui/postcss.config.mjs`
- Create: `packages/ui/src/lib/utils.ts`

- [ ] **Step 1.1: Write `packages/ui/package.json`**

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./styles/globals.css": "./src/styles/globals.css",
    "./postcss": "./postcss.config.mjs",
    "./tokens": "./src/tokens.ts",
    "./lib/utils": "./src/lib/utils.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "ui:add": "shadcn@latest add"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.469.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "shadcn": "^2.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.3"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

> If any version listed above no longer exists on npm, substitute the nearest current version and report the substitution. Specifically: `lucide-react` and `shadcn` ship frequently; check `npm view <pkg> version` if install fails.

- [ ] **Step 1.2: Write `packages/ui/tsconfig.json`**

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "components.json", "postcss.config.mjs"]
}
```

- [ ] **Step 1.3: Write `packages/ui/eslint.config.js`**

```js
import config from '@repo/eslint-config/react-internal';

export default config;
```

- [ ] **Step 1.4: Write `packages/ui/postcss.config.mjs`**

```mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 1.5: Write `packages/ui/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 1.6: Install + typecheck**

Run from repo root:
```bash
pnpm install
pnpm --filter @repo/ui typecheck
```
Expected: pnpm resolves new deps, typecheck exits 0.

- [ ] **Step 1.7: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(ui): scaffold @repo/ui package"
```

---

## Task 2: shadcn/ui CLI initialization

**Files:**
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/styles/globals.css`

shadcn's CLI normally writes `components.json` itself, but inside a workspace package we hand-write it (the CLI's interactive prompts don't always recognize monorepo paths).

- [ ] **Step 2.1: Write `packages/ui/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@repo/ui/components",
    "utils": "@repo/ui/lib/utils",
    "ui": "@repo/ui/components",
    "lib": "@repo/ui/lib",
    "hooks": "@repo/ui/hooks"
  },
  "iconLibrary": "lucide"
}
```

> shadcn config schema URL is `https://ui.shadcn.com/schema.json`; confirm it still loads. If the schema has moved, the value is informational — keep the JSON shape per the working version.

- [ ] **Step 2.2: Write `packages/ui/src/styles/globals.css`**

This is the Tailwind v4 entry point + theme tokens. Tailwind v4 uses `@theme` (CSS-native) instead of `tailwind.config.js`.

```css
@import "tailwindcss";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.145 0 0);
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-secondary-foreground: oklch(0.205 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-accent-foreground: oklch(0.205 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-destructive-foreground: oklch(0.985 0 0);
  --color-border: oklch(0.922 0 0);
  --color-input: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
```

- [ ] **Step 2.3: Verify typecheck still passes**

```bash
pnpm --filter @repo/ui typecheck
```
Expected: exit 0.

- [ ] **Step 2.4: Commit**

```bash
git add packages/ui/components.json packages/ui/src/styles
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(ui): add shadcn config + Tailwind v4 theme"
```

---

## Task 3: Three shadcn primitives — button, card, badge

**Files:**
- Create: `packages/ui/src/components/button.tsx`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/badge.tsx`

These are the standard shadcn/ui "new-york" variants. Hand-writing rather than running `shadcn add` because the CLI struggles with workspace packages — the source-of-truth content is below.

- [ ] **Step 3.1: Write `packages/ui/src/components/button.tsx`**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@repo/ui/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow hover:opacity-90',
        destructive: 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] shadow-sm hover:opacity-90',
        outline: 'border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
        secondary: 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] shadow-sm hover:opacity-80',
        ghost: 'hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]',
        link: 'text-[var(--color-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
```

- [ ] **Step 3.2: Write `packages/ui/src/components/card.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@repo/ui/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-[var(--color-muted-foreground)]', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';
```

- [ ] **Step 3.3: Write `packages/ui/src/components/badge.tsx`**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@repo/ui/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow hover:opacity-80',
        secondary: 'border-transparent bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:opacity-80',
        destructive: 'border-transparent bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] shadow hover:opacity-80',
        outline: 'text-[var(--color-foreground)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
```

- [ ] **Step 3.4: Typecheck + lint**

```bash
pnpm --filter @repo/ui typecheck && pnpm --filter @repo/ui lint
```
Expected: both exit 0.

- [ ] **Step 3.5: Commit**

```bash
git add packages/ui/src/components
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(ui): add button, card, badge primitives"
```

---

## Task 4: Design tokens for the native side

**Files:**
- Create: `packages/ui/src/tokens.ts`

A small TS mirror of the Tailwind theme that the React Native app (Plan 5) consumes — colors as hex (RN can't read OKLCH yet), spacing as numbers, typography sizes.

- [ ] **Step 4.1: Write `packages/ui/src/tokens.ts`**

```ts
/**
 * Design tokens shared between web (Tailwind v4) and native (NativeWind/RN StyleSheet).
 * Web reads tokens from `src/styles/globals.css` via @theme. Native reads from this file
 * directly — keep them visually equivalent. When you change one, change both.
 *
 * Colors are converted from OKLCH (used in CSS) to hex for RN compatibility.
 */
export const colors = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  card: '#ffffff',
  cardForeground: '#0a0a0a',
  popover: '#ffffff',
  popoverForeground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  secondary: '#f5f5f5',
  secondaryForeground: '#171717',
  muted: '#f5f5f5',
  mutedForeground: '#737373',
  accent: '#f5f5f5',
  accentForeground: '#171717',
  destructive: '#dc2626',
  destructiveForeground: '#fafafa',
  border: '#e5e5e5',
  input: '#e5e5e5',
  ring: '#a3a3a3',
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
```

- [ ] **Step 4.2: Typecheck**

```bash
pnpm --filter @repo/ui typecheck
```
Expected: exit 0.

- [ ] **Step 4.3: Commit**

```bash
git add packages/ui/src/tokens.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(ui): add design tokens for native parity"
```

---

## Task 5: `@repo/auth` package skeleton

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/eslint.config.js`
- Create: `packages/auth/src/index.ts`

`@repo/auth` is consumed by Next.js apps only — it depends on `@workos-inc/authkit-nextjs` and re-exports a small surface so consumers don't need to know the underlying SDK shape. The Next.js peer-dep version split (Tasks 9 + Plan 1's pnpm warning) is finally resolved by pinning here.

- [ ] **Step 5.1: Write `packages/auth/package.json`**

```json
{
  "name": "@repo/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./middleware": "./src/middleware.ts",
    "./server": "./src/server.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@workos-inc/authkit-nextjs": "^2.13.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^24.0.0",
    "next": "^16.1.4",
    "typescript": "^5.9.3"
  },
  "peerDependencies": {
    "next": "^16.0.0"
  }
}
```

- [ ] **Step 5.2: Write `packages/auth/tsconfig.json`**

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "lib": ["ES2022", "dom"],
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 5.3: Write `packages/auth/eslint.config.js`**

```js
import config from '@repo/eslint-config/base';

export default config;
```

- [ ] **Step 5.4: Write `packages/auth/src/index.ts`**

```ts
export { authkitMiddleware } from './middleware';
export { withAuth, signInUrl, signOutUrl } from './server';
```

- [ ] **Step 5.5: Install**

```bash
pnpm install
```
Expected: workspace links resolved, `@workos-inc/authkit-nextjs` pulled.

- [ ] **Step 5.6: Commit**

```bash
git add packages/auth pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(auth): scaffold @repo/auth package"
```

---

## Task 6: AuthKit middleware wrapper

**Files:**
- Create: `packages/auth/src/middleware.ts`

In Next.js 16 the file is named `proxy.ts` (was `middleware.ts` pre-16). `@workos-inc/authkit-nextjs` exports `authkitMiddleware` — we re-export it with our own typed wrapper so consumers get a single-import experience and easy override of the default config.

- [ ] **Step 6.1: Write `packages/auth/src/middleware.ts`**

```ts
import { authkitMiddleware as workosAuthkitMiddleware } from '@workos-inc/authkit-nextjs';
import type { NextRequest } from 'next/server';

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
  return async (request: NextRequest) => {
    const handler = workosAuthkitMiddleware({
      middlewareAuth: {
        enabled: Boolean(config.protectedRoutes?.length),
        unauthenticatedPaths: [],
      },
      redirectUri: config.redirectUri,
    });
    return handler(request);
  };
}
```

> Verify the `@workos-inc/authkit-nextjs` API surface matches — read `node_modules/@workos-inc/authkit-nextjs/dist/index.d.ts` if any TypeScript error appears. The package's API is generally stable but option names may differ.

- [ ] **Step 6.2: Typecheck**

```bash
pnpm --filter @repo/auth typecheck
```
Expected: exit 0.

- [ ] **Step 6.3: Commit**

```bash
git add packages/auth/src/middleware.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(auth): add authkitMiddleware factory"
```

---

## Task 7: AuthKit server helpers

**Files:**
- Create: `packages/auth/src/server.ts`

Server-side helpers used in Server Components, Route Handlers, and Server Actions. Re-exports `withAuth` from the AuthKit SDK + adds two URL builders.

- [ ] **Step 7.1: Write `packages/auth/src/server.ts`**

```ts
import {
  withAuth as workosWithAuth,
  getSignInUrl as workosGetSignInUrl,
  signOut as workosSignOut,
} from '@workos-inc/authkit-nextjs';

/**
 * Returns the current authenticated user (or null if unauthenticated and
 * `ensureSignedIn` is false). Pass `{ ensureSignedIn: true }` to redirect to
 * sign-in instead of returning null.
 */
export const withAuth = workosWithAuth;

/** URL of the WorkOS-hosted sign-in page. Pass `returnPath` to deep-link back. */
export async function signInUrl(returnPath?: string): Promise<string> {
  return workosGetSignInUrl({ returnPathname: returnPath });
}

/** Server action that clears the AuthKit session cookie and redirects. */
export const signOutUrl = workosSignOut;
```

> If `@workos-inc/authkit-nextjs` exports differ (e.g. `getSignInUrl` named differently), inspect `node_modules/@workos-inc/authkit-nextjs/dist/index.d.ts` and adapt — the names above match v2.13. Report any deviation.

- [ ] **Step 7.2: Typecheck**

```bash
pnpm --filter @repo/auth typecheck
```
Expected: exit 0.

- [ ] **Step 7.3: Commit**

```bash
git add packages/auth/src/server.ts
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(auth): add withAuth, signInUrl, signOutUrl helpers"
```

---

## Task 8: `apps/website` Next.js scaffold

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/next.config.ts`
- Create: `apps/website/postcss.config.mjs`
- Create: `apps/website/eslint.config.js`
- Create: `apps/website/next-env.d.ts`

Standard Next.js 16 App Router setup. We deliberately do NOT use `create-next-app` because it generates files we don't want (default README, default ESLint config, etc.) — hand-writing keeps control.

- [ ] **Step 8.1: Write `apps/website/package.json`**

```json
{
  "name": "website",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/env": "workspace:*",
    "@repo/ui": "workspace:*",
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

- [ ] **Step 8.2: Write `apps/website/tsconfig.json`**

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

- [ ] **Step 8.3: Write `apps/website/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/ui'],
};

export default config;
```

- [ ] **Step 8.4: Write `apps/website/postcss.config.mjs`**

```mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 8.5: Write `apps/website/eslint.config.js`**

```js
import config from '@repo/eslint-config/nextjs';

export default config;
```

- [ ] **Step 8.6: Write `apps/website/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 8.7: Install**

```bash
pnpm install
```
Expected: Next.js, React 19, Tailwind v4 pulled. Workspace links to `@repo/ui` and `@repo/env` resolve.

- [ ] **Step 8.8: Commit**

```bash
git add apps/website pnpm-lock.yaml
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(website): scaffold Next.js 16 app shell"
```

---

## Task 9: Website env validation

**Files:**
- Create: `apps/website/env.ts`
- Create: `apps/website/.env.local.example`

The website's env module calls `createWebsiteEnv()` from `@repo/env/website`, which throws at module-load on missing/invalid env. The dev server fails fast.

- [ ] **Step 9.1: Write `apps/website/env.ts`**

```ts
import { createWebsiteEnv } from '@repo/env/website';

export const env = createWebsiteEnv();
```

- [ ] **Step 9.2: Write `apps/website/.env.local.example`**

```bash
# Required by every Next.js app to talk to Convex.
# Copy from packages/backend/.env.local (CONVEX_URL value).
NEXT_PUBLIC_CONVEX_URL=

# Public-facing URL for metadata, OG, sitemap.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 9.3: Verify env:check skips when no .env.local exists**

From repo root:
```bash
pnpm env:check
```
Expected: `· website  skip — no file at apps/website/.env.local`. Other apps still skip.

- [ ] **Step 9.4: Create a working .env.local for dev (not committed — covered by .gitignore)**

```bash
cat > apps/website/.env.local <<'EOF'
NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
```

(Substitute the real `NEXT_PUBLIC_CONVEX_URL` from `packages/backend/.env.local` if you want the website to actually talk to Convex; for marketing pages it's not used, just present.)

- [ ] **Step 9.5: Verify env:check now passes for website**

```bash
pnpm env:check
```
Expected: `✓ website  pass`.

- [ ] **Step 9.6: Commit**

```bash
git add apps/website/env.ts apps/website/.env.local.example
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(website): add env validation + .env.local.example"
```

---

## Task 10: Website root layout + global styles

**Files:**
- Create: `apps/website/app/layout.tsx`
- Create: `apps/website/app/globals.css`
- Create: `apps/website/app/favicon.ico` (placeholder — can be empty/0-byte for now)

The root layout pulls in Geist via `next/font` (Vercel's default sans-serif), loads `@repo/ui/styles/globals.css` for theme tokens, sets sensible metadata defaults.

- [ ] **Step 10.1: Write `apps/website/app/globals.css`**

```css
@import "@repo/ui/styles/globals.css";
```

- [ ] **Step 10.2: Write `apps/website/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { env } from '../env';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'turborepo-convex-workos-template',
    template: '%s — turborepo-convex-workos-template',
  },
  description: 'A multi-tenant SaaS template built on Turborepo, Convex, and WorkOS AuthKit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10.3: Create empty favicon placeholder**

```bash
touch apps/website/app/favicon.ico
```

- [ ] **Step 10.4: Typecheck**

```bash
pnpm --filter website typecheck
```
Expected: exit 0.

- [ ] **Step 10.5: Commit**

```bash
git add apps/website/app
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(website): add root layout + Geist font + theme import"
```

---

## Task 11: Landing page components

**Files:**
- Create: `apps/website/components/landing/hero.tsx`
- Create: `apps/website/components/landing/features.tsx`
- Create: `apps/website/components/landing/footer.tsx`

Three small server components. No interactivity needed for a marketing page — keeps client JS to zero.

- [ ] **Step 11.1: Write `apps/website/components/landing/hero.tsx`**

```tsx
import { Button } from '@repo/ui/components/button';

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-32 text-center">
      <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Multi-tenant SaaS template
      </p>
      <h1 className="mb-6 text-balance text-5xl font-bold tracking-tight sm:text-6xl">
        Ship a tenant-aware SaaS in a weekend.
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-[var(--color-muted-foreground)]">
        A Turborepo monorepo with Convex, WorkOS AuthKit, Next.js 16, and bare React Native — everything wired so you can swap the demo feature and ship.
      </p>
      <div className="flex justify-center gap-3">
        <Button size="lg">Get started</Button>
        <Button size="lg" variant="outline" asChild>
          <a href="https://github.com/J-Giggles/turborepo-convex-workos-template">View on GitHub</a>
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 11.2: Write `apps/website/components/landing/features.tsx`**

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';

const features = [
  {
    title: 'Convex backend',
    body: 'Real-time reactive database with TypeScript queries. Every model layer change propagates to the UI without a fetch.',
  },
  {
    title: 'WorkOS auth',
    body: 'AuthKit hosted sign-in, organizations as tenants, webhook-mirrored to Convex for join-friendly local queries.',
  },
  {
    title: 'Multi-tenant routing',
    body: 'A separate Next.js app handles every tenant subdomain and custom domain via proxy.ts host resolution.',
  },
  {
    title: 'Bare React Native',
    body: 'Native iOS and Android with NativeWind, no Expo. Shares the Convex API + WorkOS PKCE flow with the web side.',
  },
  {
    title: 'shadcn/ui + Tailwind v4',
    body: 'Composable primitives, OKLCH theme tokens, and a tiny native token mirror so design parity is real.',
  },
  {
    title: 'Validated env',
    body: 'T3-style zod schemas validate every app’s .env at boot. pnpm dev refuses to start on invalid config.',
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">What you get</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 11.3: Write `apps/website/components/landing/footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-[var(--color-muted-foreground)]">
        <p>turborepo-convex-workos-template</p>
        <p>
          Built with{' '}
          <a className="underline underline-offset-4" href="https://convex.dev">
            Convex
          </a>{' '}
          +{' '}
          <a className="underline underline-offset-4" href="https://workos.com/authkit">
            WorkOS
          </a>{' '}
          +{' '}
          <a className="underline underline-offset-4" href="https://nextjs.org">
            Next.js
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 11.4: Typecheck + lint**

```bash
pnpm --filter website typecheck && pnpm --filter website lint
```
Expected: exit 0 for both.

- [ ] **Step 11.5: Commit**

```bash
git add apps/website/components
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(website): add hero, features, footer components"
```

---

## Task 12: Landing page composition + dev server smoke test

**Files:**
- Create: `apps/website/app/page.tsx`

- [ ] **Step 12.1: Write `apps/website/app/page.tsx`**

```tsx
import { Hero } from '../components/landing/hero';
import { Features } from '../components/landing/features';
import { Footer } from '../components/landing/footer';

export default function Page() {
  return (
    <main>
      <Hero />
      <Features />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 12.2: Smoke-test dev server**

Run as a background task with timeout:

```bash
cd /home/jgigg/code/turborepo-convex-workos-template
pnpm --filter website dev > /tmp/website-dev.log 2>&1 &
WEBPID=$!
sleep 25
tail -25 /tmp/website-dev.log
echo "---HTTP CHECK---"
curl -fsS -o /tmp/website-page.html -w "%{http_code}\n" http://localhost:3000/ || echo "fetch failed"
echo "---HEADER CHECK---"
grep -q "Ship a tenant-aware SaaS" /tmp/website-page.html && echo "hero text present" || echo "MISSING hero text"
kill $WEBPID 2>/dev/null || true
wait $WEBPID 2>/dev/null || true
```

Expected:
- `tail` shows `Ready in <ms>` and `Local: http://localhost:3000`
- `curl` returns `200`
- Hero text "Ship a tenant-aware SaaS" appears in the rendered HTML

If the smoke check fails (HTTP non-200, missing hero), do NOT commit. Report which check failed.

- [ ] **Step 12.3: Build verification**

```bash
pnpm --filter website build
```
Expected: build completes, no type or lint errors. `apps/website/.next/` is created.

- [ ] **Step 12.4: Commit**

```bash
git add apps/website/app/page.tsx
git -c user.name=Jordan -c user.email=jordan@lifepass.eu commit -m "feat(website): compose landing page (hero, features, footer)"
```

---

## Task 13: Full-monorepo smoke test

After all per-package work, verify the whole monorepo still builds and lints cleanly. This is the "did anything break elsewhere?" gate.

- [ ] **Step 13.1: Run all the green-checks**

From repo root:
```bash
pnpm install
pnpm env:check
pnpm typecheck
pnpm lint
pnpm --filter @repo/backend test
```

Expected:
- `env:check` — `✓ website pass`, others skip
- `typecheck` — successful for `@repo/backend`, `@repo/env`, `@repo/auth`, `@repo/ui`, `website` (5 tasks)
- `lint` — green across all packages with `lint` scripts (4 tasks)
- `test` — 8 passing in `@repo/backend`

If any task fails, stop and report which one with full output.

- [ ] **Step 13.2: Tag the milestone**

```bash
git tag -a website-and-shared-complete -m "Plan 2: shared packages + marketing site"
```

---

## Done

When this plan completes, the repo has:

- `@repo/ui` — shadcn/ui setup, 3 primitives (button/card/badge), Tailwind v4 theme tokens, design-token mirror for native
- `@repo/auth` — `authkitMiddleware()` + `withAuth`/`signInUrl`/`signOutUrl` helpers
- `apps/website` — public Next.js 16 marketing site at `localhost:3000` with hero/features/footer
- Tag `website-and-shared-complete` on the merge commit

Plan 3 (`docs/superpowers/plans/2026-05-XX-dashboard.md`) builds on this by adding `apps/dashboard` consuming all three packages: AuthKit-gated CRUD UI for posts, members list, custom-domain provisioning via the Vercel Domains REST API.
