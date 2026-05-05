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
