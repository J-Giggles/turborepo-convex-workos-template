# turborepo-convex-workos-template — Design

**Status:** Approved (2026-05-04)
**Owner:** Jordan
**Type:** Greenfield template repo

## 1. Goal

A reusable starter monorepo for multi-tenant SaaS products. Drop-in stack: Turborepo + pnpm + Next.js 16 + Convex + WorkOS AuthKit + bare React Native, with multi-tenant routing patterned after Vercel Platforms and a small but realistic "posts" demo feature exercising every layer end-to-end.

The template is for Jordan's own future projects — fork, rename, replace the demo feature, ship.

## 2. Non-goals

- Billing / Stripe / Polar integration (leave a `TODO: billing` marker)
- Internationalization (i18n)
- Analytics SDK wiring
- End-to-end browser tests (Playwright stays opt-in)
- CI workflows beyond a basic `.github/workflows/ci.yml` running `turbo lint typecheck build`
- Storybook / component galleries
- Mobile push notifications (no Expo Push Service available on bare RN out of the box)

## 3. Repo layout

```
turborepo-convex-workos-template/
├── apps/
│   ├── website/              # Marketing site — Next.js 16, public, ISR
│   ├── dashboard/            # Org/admin control plane — Next.js 16, AuthKit-gated
│   ├── tenant/               # Multi-tenant runtime — Next.js 16, proxy.ts host routing
│   └── native/               # Bare React Native (RN CLI, NOT Expo) + NativeWind
├── packages/
│   ├── backend/              # Convex schema, functions, http actions, components, WorkOS webhook
│   ├── ui/                   # shadcn/ui components, Tailwind v4 preset (web only)
│   ├── auth/                 # WorkOS AuthKit helpers shared by web apps
│   ├── env/                  # T3 @t3-oss/env-nextjs schemas — one file per app context
│   ├── eslint-config/
│   └── typescript-config/
├── docs/
│   └── superpowers/
│       └── specs/            # this design + future specs live here
├── .github/workflows/ci.yml
├── package.json              # pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json
├── .prettierrc
├── .nvmrc                    # 20.19.4
└── README.md
```

## 4. Stack versions

| Concern | Choice |
|---|---|
| Monorepo | Turborepo `^2`, pnpm workspaces |
| Web framework | Next.js 16 App Router, React 19 |
| Mobile | React Native 0.76+ via `@react-native-community/cli` (bare), NativeWind v4 |
| Backend | Convex `^1.29` |
| Auth (web) | `@workos-inc/authkit-nextjs` for browser session, `@workos-inc/node` for server APIs |
| Auth (native) | `react-native-app-auth` PKCE flow, `react-native-keychain` for token storage |
| Convex⇄WorkOS | `@convex-dev/workos-authkit` for token validation; HTTP action for webhook sync |
| Styling (web) | Tailwind CSS v4 (`@tailwindcss/postcss`) + shadcn/ui |
| Styling (native) | NativeWind v4 |
| Env validation | `@t3-oss/env-nextjs` + zod, per-app schema in `packages/env` |
| Lint/format | ESLint 9 (flat config) + Prettier 3 |
| Node | `>=20.19.4` (`.nvmrc` pinned) |

## 5. Multi-tenant routing

The tenant app uses `proxy.ts` (Next 16's renamed `middleware.ts`) to map host → tenant on every request:

1. Read `Host` header.
2. Look up tenant by host using a Convex query keyed on `domains.host`.
   - Platform-subdomains (e.g. `acme.example.com`) — the host's leftmost label is the `organizations.slug`; verified at lookup time against the `organizations` table.
   - Custom domains (e.g. `app.acmecorp.com`) — match by full host against `domains.host`.
3. Rewrite to internal route group `/_tenant/[slug]/...`. The `[slug]` segment is never visible in the URL.
4. The lookup result is cached at the edge using Vercel Runtime Cache, tagged `tenant:{host}`. CRUD on `domains` calls `updateTag('tenant:{host}')`.

`proxy.ts` matcher excludes `/api`, `/_next`, static assets, and the WorkOS callback path. Apex (`example.com`) on the tenant app issues a permanent redirect to the marketing website domain.

**Custom domain provisioning:** dashboard provisions via the Vercel Domains REST API. Required env vars on the dashboard:

- `VERCEL_API_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID_TENANT` — tenant app's project ID

Domain rows in Convex track `verified` state; a verification cron polls Vercel until verified or a TTL expires.

## 6. Auth flow

```
Browser (dashboard)
  └─> WorkOS AuthKit hosted page ──> /callback (sealed session cookie)
        └─> Convex client uses AuthKit JWT
              └─> @convex-dev/workos-authkit validates on every fn call
WorkOS webhook ──> Convex http action ──> sync users/organizations into Convex tables
Native app
  └─> react-native-app-auth PKCE ──> AuthKit access token ──> Convex client
```

- **Dashboard** — full AuthKit cookie session; server components read user via `withAuth()`.
- **Tenant app** — read-mostly public; auth optional. If a tenant feature needs login, it uses the same AuthKit flow with a different return URL.
- **Website** — no auth.
- **Native** — `react-native-app-auth` PKCE, tokens kept in `react-native-keychain`.

WorkOS Organizations are the source of truth for tenancy; they are mirrored to Convex `organizations` for query speed and join-friendliness. Membership is mirrored from WorkOS via webhook events (`user.created`, `user.updated`, `user.deleted`, `organization_membership.created`, etc.).

## 7. Convex data model

```ts
// packages/backend/convex/schema.ts (sketch)
organizations: {
  workosOrgId: string,
  slug: string,
  name: string,
  createdAt: number,
}
domains: {
  orgId: Id<"organizations">,
  host: string,           // unique
  isPrimary: boolean,
  verified: boolean,
  vercelConfigId: string | null,
}
members: {
  workosUserId: string,
  orgId: Id<"organizations">,
  role: "admin" | "member",
}
users: {
  workosUserId: string,   // unique
  email: string,
  name: string | null,
  avatarUrl: string | null,
}
posts: {                  // demo feature
  orgId: Id<"organizations">,
  authorWorkosUserId: string,
  title: string,
  body: string,
  slug: string,           // unique within org
  published: boolean,
  createdAt: number,
}
```

Indexes: `organizations.by_workos_org_id`, `organizations.by_slug`, `domains.by_host`, `domains.by_org`, `members.by_user_org`, `members.by_org`, `users.by_workos_user_id`, `posts.by_org_published`, `posts.by_org_slug`.

### Demo feature: "Posts"

Wires the whole stack:

- **Dashboard** (`/posts`) — auth-gated CRUD scoped to active org.
- **Tenant app** (`/{post-slug}`) — public read of published posts for the resolved tenant.
- **Native app** — auth-gated list + detail of own org's posts.

## 8. T3 env contract

`packages/env` exports four schemas, one per app:

```ts
// packages/env/src/website.ts   — minimal: NEXT_PUBLIC_SITE_URL etc.
// packages/env/src/dashboard.ts — AUTHKIT_*, NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY,
//                                 VERCEL_API_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID_TENANT
// packages/env/src/tenant.ts    — AUTHKIT_*, NEXT_PUBLIC_CONVEX_URL
// packages/env/src/native.ts    — WORKOS_CLIENT_ID, CONVEX_URL, AUTHKIT_REDIRECT_URI
```

Each app imports its schema and re-exports as `env`. `createEnv` runs at module-load time so build/startup fails fast on missing or invalid vars. A shared `serverShared.ts` holds Convex/WorkOS keys re-used across schemas.

Optional component env vars (`R2_*`, `RESEND_API_KEY`) are declared as optional — when unset, the components no-op.

## 9. Turbo pipeline

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev":        { "cache": false, "persistent": true,
                    "dependsOn": ["@repo/backend#dev"] },
    "build":      { "dependsOn": ["^build"],
                    "outputs": [".next/**", "!.next/cache/**"] },
    "typecheck":  { "dependsOn": ["^build"] },
    "lint":       {},
    "@repo/backend#dev": { "cache": false, "persistent": true }
  }
}
```

Root scripts: `pnpm dev` (everything in parallel via Turbo), `pnpm dev:web` (filtered to website + dashboard + tenant + backend), `pnpm dev:native` (native + backend).

## 10. Convex components installed

Installed and wired in `packages/backend/convex/convex.config.ts`:

| Component | Package | Role |
|---|---|---|
| WorkOS AuthKit | `@convex-dev/workos-authkit` | Token validation (§6) |
| Migrations | `@convex-dev/migrations` | Widen→migrate→narrow workflow; ship one example migration |
| Rate Limiter | `@convex-dev/rate-limiter` | Sliding-window limit on public tenant queries + WorkOS callback |
| Crons | `@convex-dev/crons` | Daily `reconcileMembers` cron + custom-domain verification cron |
| Aggregate | `@convex-dev/aggregate` | `postsByOrg` aggregate; dashboard home reads counts |
| R2 | `@convex-dev/r2` | Optional file uploads; env-gated, no-op when `R2_*` unset |
| Resend | `@convex-dev/resend` | Transactional email; env-gated, no-op when `RESEND_API_KEY` unset |

**Deliberately skipped** (add at fork time):

- `@convex-dev/agent`, `@convex-dev/workflow`, `@convex-dev/persistent-text-streaming` — AI/durable-execution
- `@convex-dev/polar` — billing is a non-goal (§2)
- `@convex-dev/twilio`, `@convex-dev/expo-push-notifications` — feature-specific; push component requires Expo Push Service which doesn't drop into bare RN cleanly
- `@convex-dev/action-cache`, `@convex-dev/action-retrier`, `@convex-dev/sharded-counter`, `@convex-dev/presence`, `@convex-dev/geospatial` — niche

### Demo wiring shown in code

- **Migrations** — one numbered migration backfilling a derived field on `posts` (e.g. `slug` lowercased)
- **Rate limiter** — sliding-window limit on `getPostsByHost` public query
- **Aggregate** — `postsByOrg` aggregate, surfaced as a count on dashboard home
- **Crons** — daily `reconcileMembers` cron diffing WorkOS membership against local mirror
- **R2 / Resend** — wrapped behind `getR2()` / `getResend()` helpers that return `null` when env vars unset. Callers branch on the null and skip the side effect (e.g. `await getResend()?.send(...)`). One `console.warn` per process at boot lists which integrations are disabled.

## 11. Native app specifics

- Bootstrapped with `npx @react-native-community/cli init` (bare). No `expo-*` deps.
- iOS + Android folders committed.
- NativeWind v4 + Tailwind v4 (separate config from web — no shared CSS, but shared design tokens via `packages/ui/tokens.ts`).
- Auth: `react-native-app-auth` for AuthKit PKCE; secure token storage via `react-native-keychain`.
- Convex: `convex/react` with token from auth library.
- Shares only `@repo/backend`, `@repo/env`, and design tokens with the web side. No shared UI components.

## 12. Package boundaries (what depends on what)

```
website     → env
dashboard   → env, auth, ui, backend
tenant      → env, auth (optional), ui, backend
native      → env, backend, packages/ui/tokens
backend     → (nothing internal; depends only on Convex SDK + Convex components)
ui          → (nothing internal; pure React + Tailwind + Radix)
auth        → env (for AUTHKIT_* helpers)
env         → (nothing internal)
eslint-config, typescript-config → (nothing)
```

`backend` is the data contract. UI never imports backend Convex types directly; instead it uses the public `convex/react` hooks with the generated `api` object exported from `@repo/backend`.

## 13. README contract

The repo's `README.md` documents, in order:

1. One-paragraph elevator pitch.
2. Stack table (mirrors §4).
3. **Quickstart**:
   - clone → `pnpm install`
   - `pnpm convex:setup` (runs `convex dev --until-success` in `packages/backend`)
   - WorkOS dashboard config (callback URLs, webhook URL, secrets to copy)
   - Per-app `.env.local` from `.env.local.example`
   - `pnpm dev` (web) / `pnpm dev:native`
4. **Multi-tenant local testing** — how to fake hostnames in dev (e.g. `acme.localhost:3002`).
5. **Production deployment** — Vercel project per app, Vercel Domains API token setup, Convex prod deploy.
6. **Forking checklist** — find/replace `@repo/*`, swap demo feature, etc.

## 14. Success criteria

A fork of this template should let a developer:

1. `pnpm install && pnpm convex:setup` and have a working backend within 5 minutes (modulo WorkOS dashboard signup).
2. Sign up via the dashboard, create an org → automatically becomes a tenant with the org slug subdomain.
3. Visit `{org-slug}.localhost:3002` and see the tenant app render their org name.
4. Create a published post in the dashboard → it appears at `{org-slug}.localhost:3002/{post-slug}`.
5. Add a custom domain via dashboard UI → verify state propagates correctly.
6. `pnpm dev:native` builds for iOS/Android, signs in with WorkOS, lists their org's posts.
7. `pnpm build` succeeds for every app with no env-validation errors when all required env vars are set.
8. Removing `R2_*` and `RESEND_API_KEY` from env still passes build and runs (components no-op).
