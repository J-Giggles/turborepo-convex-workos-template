# turborepo-convex-workos-template

Production-leaning starter for **multi-tenant SaaS** on Turborepo + Convex + WorkOS AuthKit. Fork it, replace the demo feature, ship.

> **Status:** Foundation + backend done (`foundation-and-backend-complete` tag). Web/native apps come in Plans 2–4.

---

## What's inside

| Layer | Choice |
|---|---|
| Monorepo | Turborepo 2 + pnpm 9 workspaces |
| Backend | [Convex](https://convex.dev) — schema, real-time queries, HTTP actions, components |
| Auth | [WorkOS AuthKit](https://workos.com/auth) (web cookie session + native PKCE) |
| Web | Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui *(planned, Plan 2)* |
| Multi-tenant | `proxy.ts` host routing à la [Vercel Platforms](https://vercel.com/templates/next.js/platforms-starter-kit) *(planned, Plan 3)* |
| Mobile | **Bare React Native** (no Expo) + NativeWind *(planned, Plan 4)* |
| Env | `@t3-oss/env-core` per-app schemas + `pnpm env:check` validator that fires on every `pnpm dev` |
| Lint/format | ESLint 9 flat config + Prettier 3 |

### Convex components wired in `packages/backend/`

| Component | Purpose | Demo wiring |
|---|---|---|
| `@convex-dev/workos-authkit` | JWT validation on every function call | `convex/auth.config.ts` |
| `@convex-dev/migrations` | widen → migrate → narrow workflow | example backfill at `convex/migrations.ts` |
| `@convex-dev/rate-limiter` | token-bucket throttling | `posts.listPublishedByHost` |
| `@convex-dev/aggregate` | namespaced counts | `postsByOrg` (kept in sync by `posts.create`/`remove`) |
| `@convex-dev/r2` | Cloudflare R2 file storage | env-gated `getR2()` returns `null` when unset |
| `@convex-dev/resend` | transactional email | env-gated `getResend()` returns `null` when unset |
| `cronJobs()` (built-in) | scheduled work | `reconcileMembers` (daily) + `verifyDomains` (every 5 min) |

---

## Layout

```
turborepo-convex-workos-template/
├── apps/                       # ← Plans 2-4 will scaffold these
│   ├── website/                # marketing — Next.js 16
│   ├── dashboard/              # admin/control plane — Next.js 16
│   ├── tenant/                 # multi-tenant runtime — Next.js 16, proxy.ts host routing
│   └── native/                 # bare React Native + NativeWind
├── packages/
│   ├── backend/                # Convex schema + functions + components
│   ├── ui/                     # shadcn/ui + Tailwind preset (Plan 2)
│   ├── auth/                   # WorkOS AuthKit helpers (Plan 2)
│   ├── env/                    # @t3-oss/env-core schemas per app + check.ts validator
│   ├── eslint-config/          # flat configs (base, nextjs, react-internal)
│   └── typescript-config/      # 5 presets (base, node, nextjs, react-library, react-native)
├── docs/superpowers/
│   ├── specs/                  # design docs
│   └── plans/                  # implementation plans (Plan 1 done)
└── .env.example                # master env reference, 7 labelled sections
```

---

## Quickstart

### 1. Install

```bash
pnpm install
```

### 2. First-time Convex setup

```bash
pnpm convex:setup
```

Browser opens → log into / sign up for [Convex](https://dashboard.convex.dev) → create a project. The CLI populates `packages/backend/.env.local` with your deployment URL. Press **Ctrl+C** once it says *"Functions ready!"*.

### 3. Set Convex env vars

WorkOS server credentials live on the **Convex deployment**, not in any local `.env` file. From the repo root:

```bash
cd packages/backend
npx convex env set WORKOS_AUTHKIT_DOMAIN 'https://your-tenant.authkit.app'
npx convex env set WORKOS_CLIENT_ID 'client_xxx'
npx convex env set WORKOS_API_KEY 'sk_xxx'
npx convex env set WORKOS_WEBHOOK_SECRET 'sk_webhook_xxx'
```

Get those values from [dashboard.workos.com](https://dashboard.workos.com) → API Keys / AuthKit / Webhooks.

> **Don't have WorkOS yet?** The repo ships with placeholder values pre-set on the dev deployment so `convex dev` boots cleanly. Replace whenever you're ready.

### 4. Configure the WorkOS webhook

In the WorkOS dashboard:

- **Endpoint URL** → `https://<your-deployment>.convex.site/workos/webhook`
  *(get the deployment slug from `packages/backend/.env.local` — `CONVEX_URL`)*
- **Events** → `user.*`, `organization.*`, `organization_membership.*`
- Copy the **signing secret** into `WORKOS_WEBHOOK_SECRET` via the `npx convex env set` command above.

### 5. Optional integrations

R2 and Resend are env-gated — completely optional. The Convex helpers (`getR2()`, `getResend()`) return `null` when env vars are unset, so callers no-op safely.

```bash
cd packages/backend
npx convex env set RESEND_API_KEY 'rs_xxx'
npx convex env set R2_ENDPOINT 'https://<account-id>.r2.cloudflarestorage.com'
npx convex env set R2_ACCESS_KEY_ID '...'
npx convex env set R2_SECRET_ACCESS_KEY '...'
npx convex env set R2_BUCKET 'my-bucket'
```

### 6. Run

```bash
pnpm dev          # validate every per-app .env.local, then turbo dev
pnpm test         # vitest run (8 tests right now)
pnpm typecheck    # tsc --noEmit across all packages
pnpm lint         # eslint flat config across all packages
pnpm convex:dev   # just convex dev (no env-check, no other apps)
```

---

## Env validation

`pnpm dev` runs `pnpm env:check` first — a small Node CLI in `packages/env/src/check.ts` that:

1. Reads `apps/{website,dashboard,tenant,native}/.env.local` (or `.env` for native).
2. Validates each against the per-app zod schema in `packages/env/src/<app>.ts`.
3. Skips files that don't exist (so the check is a no-op until apps are scaffolded).
4. Exits **1** with line-by-line errors if anything's missing or malformed.

Per-app schemas all live in `packages/env/src/`:

- `website.ts` → public site URL only
- `dashboard.ts` → WorkOS server creds + Vercel API token + AuthKit client domain + dashboard URL
- `tenant.ts` → WorkOS server creds + AuthKit client domain + platform root
- `native.ts` → AuthKit (PKCE) + Convex URL

Apps consume them via factories: `export const env = createDashboardEnv()` — fails at app boot on any invalid value.

The full list of env vars (with which app reads each, where to get the value) is in **[`.env.example`](./.env.example)**.

---

## Convex demo data model

Five tables, see `packages/backend/convex/schema.ts`:

| Table | Role |
|---|---|
| `organizations` | tenant record (mirrored from WorkOS) |
| `domains` | host → org lookup, with `verified` flag for custom domains |
| `members` | role per (user, org), mirrored from WorkOS |
| `users` | WorkOS user mirror |
| `posts` | demo feature exercising the full stack |

Indexes follow Convex's "include all field names" convention (`by_org_id_and_published`, etc.) per the AGENTS guideline at `convex/_generated/ai/guidelines.md`.

---

## Roadmap

- [x] **Plan 1** — Foundation + Convex backend *(this is what's tagged)*
- [ ] **Plan 2** — Shared web packages (`@repo/ui`, `@repo/auth`) + `apps/website` + `apps/dashboard`
- [ ] **Plan 3** — `apps/tenant` (multi-tenant `proxy.ts` runtime)
- [ ] **Plan 4** — `apps/native` (bare RN + NativeWind + WorkOS PKCE)

Plan documents live under [`docs/superpowers/plans/`](./docs/superpowers/plans/) and the design spec is at [`docs/superpowers/specs/2026-05-04-turborepo-convex-workos-template-design.md`](./docs/superpowers/specs/2026-05-04-turborepo-convex-workos-template-design.md).

---

## Known caveats

Tracked in commits + plan followups:

- **`posts.listPublishedByHost`** uses `rateLimiter.check()` (read-only) because Convex queries can't run mutations. The bucket isn't actively decremented — fine as a wiring demo, but for real abuse protection, route public reads through an action that calls `rateLimiter.limit(...)` first. Caveat is documented inline in `convex/posts.ts`.
- **Stale `.js` build twins** appear in `convex/` if you bypass `noEmit: true` — already gitignored at `convex/*.js` (excluding `_generated/`).

---

## License

MIT — do whatever you want with it.
