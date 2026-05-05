import { signOutUrl } from '@repo/auth/server';

// AuthKit's `signOut()` clears the sealed session cookie and issues an HTTP
// redirect via Next.js's `redirect()` (it throws a NEXT_REDIRECT signal).
// We re-throw it from this route handler so the framework completes the
// redirect — there's no manual `redirect('/')` call needed here.
export async function GET() {
  await signOutUrl({ returnTo: '/' });
  // Unreachable: signOut throws a NEXT_REDIRECT before returning.
  return new Response(null, { status: 302, headers: { Location: '/' } });
}
