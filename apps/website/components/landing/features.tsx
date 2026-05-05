import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';

const features = [
  {
    title: 'Convex backend',
    body: 'Real-time reactive database with TypeScript queries. Every model layer change propagates to the UI without a fetch.',
  },
  {
    title: 'WorkOS auth',
    body: 'AuthKit hosted sign-in, organizations as tenants, webhook-mirrored to Convex for join-friendly local queries.',
  },
  {
    title: 'Multi-tenant routing',
    body: 'A separate Next.js app handles every tenant subdomain and custom domain via proxy.ts host resolution.',
  },
  {
    title: 'Bare React Native',
    body: 'Native iOS and Android with NativeWind, no Expo. Shares the Convex API + WorkOS PKCE flow with the web side.',
  },
  {
    title: 'shadcn/ui + Tailwind v4',
    body: 'Composable primitives, OKLCH theme tokens, and a tiny native token mirror so design parity is real.',
  },
  {
    title: 'Validated env',
    body: 'T3-style zod schemas validate every app’s .env at boot. pnpm dev refuses to start on invalid config.',
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">What you get</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </section>
  );
}
