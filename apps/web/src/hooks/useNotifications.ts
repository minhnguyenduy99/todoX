import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../api';

export function useNotifications() {
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  const unreadCount = useMemo(
    () => (query.data ?? []).filter((notification) => !notification.readAt).length,
    [query.data],
  );

  return {
    ...query,
    notifications: query.data ?? [],
    unreadCount,
  };
}
