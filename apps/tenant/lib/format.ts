const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatPostDate(timestampMs: number): string {
  return dateFormatter.format(new Date(timestampMs));
}
