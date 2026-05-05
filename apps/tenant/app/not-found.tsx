export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Site not found</h1>
      <p className="text-[var(--color-muted-foreground)]">
        We couldn&apos;t find a tenant for this domain. If you just added the domain in your
        dashboard, DNS verification may still be pending.
      </p>
    </main>
  );
}
