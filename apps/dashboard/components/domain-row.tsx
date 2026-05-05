'use client';

import { useState, useTransition } from 'react';
import { Button } from '@repo/ui/components/button';
import { Badge } from '@repo/ui/components/badge';

export function DomainRow({
  host,
  verified,
  onVerify,
  onRemove,
}: {
  host: string;
  verified: boolean;
  onVerify: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [isVerifying, startVerify] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 font-mono text-sm">{host}</td>
      <td className="px-4 py-2">
        <Badge variant={verified ? 'default' : 'secondary'}>
          {verified ? 'Verified' : 'Pending'}
        </Badge>
      </td>
      <td className="flex justify-end gap-1 px-4 py-2">
        {!verified && (
          <Button
            variant="outline"
            size="sm"
            disabled={isVerifying}
            onClick={() => {
              setError(null);
              startVerify(async () => {
                try {
                  await onVerify();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Verify failed.');
                }
              });
            }}
          >
            {isVerifying ? 'Checking…' : 'Verify'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={isRemoving}
          onClick={() => {
            setError(null);
            startRemove(async () => {
              try {
                await onRemove();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Remove failed.');
              }
            });
          }}
        >
          {isRemoving ? 'Removing…' : 'Remove'}
        </Button>
        {error && (
          <span className="self-center text-xs text-[var(--color-destructive)]">{error}</span>
        )}
      </td>
    </tr>
  );
}
