import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';
import { formatPostDate } from '../lib/format';

export function PostCard({
  title,
  body,
  slug,
  createdAt,
}: {
  title: string;
  body: string;
  slug: string;
  createdAt: number;
}) {
  // Take the first ~180 chars of body as a teaser. No markdown rendering at this stage.
  const teaser = body.length > 180 ? `${body.slice(0, 180).trim()}…` : body;
  return (
    <Link href={`/${slug}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{formatPostDate(createdAt)}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-foreground)]">
          {teaser}
        </CardContent>
      </Card>
    </Link>
  );
}
