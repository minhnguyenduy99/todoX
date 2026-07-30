/** Format an ISO timestamp as "30 Jul" in the local timezone. */
export function formatTodoStatusUpdateDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
