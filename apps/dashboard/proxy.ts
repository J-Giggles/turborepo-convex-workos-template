import { authkitMiddleware } from '@repo/auth/middleware';

export default authkitMiddleware({
  protectedRoutes: ['/posts/:path*', '/members/:path*', '/domains/:path*', '/'],
  signInPath: '/sign-in',
});

export const config = {
  // Run on every request EXCEPT static assets, the AuthKit callback (which
  // AuthKit needs to handle without redirect interference), and the sign-out
  // route handler.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|callback|sign-out).*)'],
};
