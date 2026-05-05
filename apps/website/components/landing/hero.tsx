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
