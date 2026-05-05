import {
  withAuth as workosWithAuth,
  getSignInUrl as workosGetSignInUrl,
  signOut as workosSignOut,
} from '@workos-inc/authkit-nextjs';

/**
 * Returns the current authenticated user (or null if unauthenticated and
 * `ensureSignedIn` is false). Pass `{ ensureSignedIn: true }` to redirect to
 * sign-in instead of returning null.
 */
export const withAuth = workosWithAuth;

/** URL of the WorkOS-hosted sign-in page. Pass `returnPath` to deep-link back. */
export async function signInUrl(returnPath?: string): Promise<string> {
  return workosGetSignInUrl({ returnTo: returnPath });
}

/** Server action that clears the AuthKit session cookie and redirects. */
export const signOutUrl = workosSignOut;
