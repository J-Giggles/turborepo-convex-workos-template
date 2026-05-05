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
