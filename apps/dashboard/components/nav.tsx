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
