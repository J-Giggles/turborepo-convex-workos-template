# @repo/backend

Convex backend for the template. Houses schema, functions, HTTP actions, and component installs.

## First-time setup

From the repo root:

```bash
pnpm install
pnpm convex:setup
```

The second command will:

1. Open a browser to log you into Convex.
2. Prompt you to create or pick a project.
3. Print a deploy URL — copy this for the front-end apps' `.env.local`.

It will then prompt for required env vars. Set them via:

```bash
cd packages/backend
npx convex env set WORKOS_CLIENT_ID 'client_xxx'
npx convex env set WORKOS_API_KEY 'sk_xxx'
npx convex env set WORKOS_AUTHKIT_DOMAIN 'https://your-tenant.authkit.app'
npx convex env set WORKOS_WEBHOOK_SECRET 'sk_webhook_xxx'
# Optional integrations:
npx convex env set RESEND_API_KEY 'rs_xxx'
npx convex env set R2_ENDPOINT 'https://<account-id>.r2.cloudflarestorage.com'
npx convex env set R2_ACCESS_KEY_ID '...'
npx convex env set R2_SECRET_ACCESS_KEY '...'
npx convex env set R2_BUCKET 'my-bucket'
```

## Day-to-day

```bash
pnpm dev          # convex dev — watches and pushes
pnpm test         # vitest run (tests live in packages/backend/tests/)
pnpm typecheck    # tsc --noEmit -p convex
```

## What's wired

| Component | Use site | Toggle |
|---|---|---|
| `@convex-dev/workos-authkit` | `auth.config.ts`; auto on every fn | env-required |
| `@convex-dev/migrations` | `migrations.ts` (one example) | always on |
| `@convex-dev/rate-limiter` | `posts.listPublishedByHost` | always on (see caveat) |
| `convex/server` `cronJobs()` | `crons.ts` (2 jobs) | always on |
| `@convex-dev/aggregate` | `postsByOrg` count | always on |
| `@convex-dev/r2` | `getR2()` returns null when env unset | `R2_ENDPOINT` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET` |
| `@convex-dev/resend` | `getResend()` returns null when env unset | `RESEND_API_KEY` |

> Crons uses Convex's built-in `cronJobs()` API (the documented pattern), not `@convex-dev/crons` — the component is not installed.

> Rate-limiter caveat: `posts.listPublishedByHost` calls `rateLimiter.check(ctx, ...)` rather than `.limit(...)` because `query` ctx can't run mutations. `check()` enforces but does not decrement, so without a paired consumer (a mutation/action that calls `.limit(...)`), the bucket never depletes. For real abuse protection, route public reads through an action that calls `.limit(...)` first, or schedule a consumer via `ctx.scheduler.runAfter`.

## WorkOS webhook

Convex deployments expose `https://<deployment>.convex.site/workos/webhook` — set this as a webhook endpoint in your WorkOS dashboard with events `user.*`, `organization.*`, `organization_membership.*`. The signing secret goes into `WORKOS_WEBHOOK_SECRET`.

## Running migrations

```bash
npx convex run internal/migrations:runAll
```
