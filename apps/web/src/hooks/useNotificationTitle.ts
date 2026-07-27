import { useEffect } from 'react';

const BASE_TITLE = 'Todo Platform';

export function formatNotificationTitle(unreadCount: number): string {
  return unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
}

export function useNotificationTitle(unreadCount: number): void {
  useEffect(() => {
    document.title = formatNotificationTitle(unreadCount);
    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);
}
