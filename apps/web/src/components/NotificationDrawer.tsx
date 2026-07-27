import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationKind, type NotificationDto } from '@todo-platform/shared-types';
import { formatDate, markAllNotificationsRead } from '../api';

interface NotificationDrawerProps {
  open: boolean;
  notifications: NotificationDto[];
  onClose: () => void;
}

export function NotificationDrawer({
  open,
  notifications,
  onClose,
}: NotificationDrawerProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    void markAllNotificationsRead().then(() => {
      queryClient.setQueryData<NotificationDto[]>(['notifications'], (old = []) =>
        old.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    });
  }, [open, queryClient]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="notification-drawer-overlay" onClick={onClose}>
      <aside
        className="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notification-drawer-header">
          <h2 id="notification-drawer-title" className="notification-drawer-title">
            Notifications
          </h2>
          <button
            type="button"
            className="subtask-panel-close"
            onClick={onClose}
            aria-label="Close notifications"
          >
            ×
          </button>
        </div>

        <div className="notification-drawer-body">
          {notifications.length === 0 ? (
            <p className="notification-drawer-empty">No notifications in the last 24 hours.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-item${notification.readAt ? ' notification-item-read' : ''}`}
                >
                  <div className="notification-item-top">
                    <span
                      className={`badge badge-sm ${notificationOutcomeColor(notification)}`}
                    >
                      {notificationKindLabel(notification.kind)}
                    </span>
                    <time className="notification-item-time" dateTime={notification.createdAt}>
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                  <p className="notification-item-title">{notification.title}</p>
                  {notification.body && (
                    <p className="notification-item-body">{notification.body}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function notificationKindLabel(kind: NotificationKind): string {
  switch (kind) {
    case NotificationKind.TODO_DEPLOYMENT:
      return 'Todo deploy';
    case NotificationKind.SUBTASK_DEPLOYMENT:
      return 'Subtask deploy';
    case NotificationKind.RELEASE_DEPLOYMENT:
      return 'Release deploy';
    case NotificationKind.TESTCASE_SCAN:
      return 'Test scan';
    default:
      return 'Event';
  }
}

function notificationOutcomeColor(notification: NotificationDto): string {
  const outcome = notification.payload.outcome;
  if (outcome === 'success') return 'badge-green';
  if (outcome === 'failure') return 'badge-red';
  return 'badge-gray';
}
