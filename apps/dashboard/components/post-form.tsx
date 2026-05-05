'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Textarea } from '@repo/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';

export type PostFormValues = {
  title: string;
  slug: string;
  body: string;
  published: boolean;
};

export function PostForm({
  initialValues,
  action,
  submitLabel,
}: {
  initialValues: PostFormValues;
  action: (values: PostFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await action(values);
            router.push('/posts');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
          }
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          required
          pattern="[a-z0-9-]+"
          value={values.slug}
          onChange={(e) => setValues({ ...values, slug: e.target.value })}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Lowercase letters, digits, and hyphens. Used as the URL path on the tenant site.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          required
          rows={10}
          value={values.body}
          onChange={(e) => setValues({ ...values, body: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={values.published ? 'published' : 'draft'}
          onValueChange={(v) => setValues({ ...values, published: v === 'published' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/posts')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
