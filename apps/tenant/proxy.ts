import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenant } from './lib/resolve-tenant';

export const config = {
  // Skip statics, API, and the special internal path itself (we set it; we don't re-rewrite).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|_tenant).*)'],
};

export default async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const result = await resolveTenant(host);

  // Apex → redirect to the marketing site. NEXT_PUBLIC_SITE_URL isn't in the
  // tenant schema (different app), so we hardcode the same protocol + host
  // pattern. Adjust here if your marketing site lives somewhere weirder.
  if (result.kind === 'apex') {
    return NextResponse.redirect(new URL('http://localhost:3000', req.url), 308);
  }

  // No matching org → render the not-found route. Don't 404 silently — give
  // the user a friendly message in the rewrite target.
  if (result.kind === 'unknown') {
    return NextResponse.rewrite(new URL('/not-found', req.url));
  }

  // Strip the leading slash from the original pathname and prepend our internal
  // route group: `/_tenant/{slug}/{...rest}`.
  const url = req.nextUrl.clone();
  const rest = url.pathname === '/' ? '' : url.pathname;
  url.pathname = `/_tenant/${result.org.slug}${rest}`;
  return NextResponse.rewrite(url);
}
