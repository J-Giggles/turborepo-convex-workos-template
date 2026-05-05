import { authkitMiddleware } from '@repo/auth/middleware';

// AuthKit 2.17's middleware reads `NEXT_PUBLIC_WORKOS_REDIRECT_URI` from
// process.env (not `WORKOS_REDIRECT_URI`). Passing the URI explicitly via
// the middleware config avoids that env-variable rename surprise.
export default authkitMiddleware({
  protectedRoutes: ['/posts/:path*', '/members/:path*', '/domains/:path*', '/'],
  signInPath: '/sign-in',
  redirectUri: process.env.WORKOS_REDIRECT_URI,
});

export const config = {
  // Run on every request EXCEPT static assets, the AuthKit callback (which
  // AuthKit needs to handle without redirect interference), and the sign-out
  // route handler.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|callback|sign-out).*)'],
};
