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
