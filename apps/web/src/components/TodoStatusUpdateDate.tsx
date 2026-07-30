import { formatTodoStatusUpdateDate } from '../utils/todoDateDisplay';

interface TodoStatusUpdateDateProps {
  statusUpdateDate: string;
  className?: string;
}

export function TodoStatusUpdateDate({
  statusUpdateDate,
  className,
}: TodoStatusUpdateDateProps) {
  const formatted = formatTodoStatusUpdateDate(statusUpdateDate);
  if (!formatted) return null;

  return (
    <time
      dateTime={statusUpdateDate}
      className={['todo-status-update-date', className].filter(Boolean).join(' ')}
      title={`Status updated ${formatted}`}
    >
      {formatted}
    </time>
  );
}
