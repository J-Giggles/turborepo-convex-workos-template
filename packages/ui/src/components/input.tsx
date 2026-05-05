import * as React from 'react';
import { cn } from '@repo/ui/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// eslint-plugin-react's prop-types rule mis-fires on intrinsic JSX elements
// typed via React.InputHTMLAttributes. TypeScript already validates props.
// eslint-disable-next-line react/prop-types
export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
