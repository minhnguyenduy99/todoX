import { useState } from 'react';
import { NotificationDrawer } from './NotificationDrawer';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationTitle } from '../hooks/useNotificationTitle';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount } = useNotifications();

  useNotificationTitle(unreadCount);

  return (
    <>
      <button
        type="button"
        className="notification-bell"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="notification-bell-icon" aria-hidden="true">
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <NotificationDrawer
        open={open}
        notifications={notifications}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
