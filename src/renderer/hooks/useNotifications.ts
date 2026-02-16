import { useState, useCallback } from 'react';
import type { Notification } from '../types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      // Avoid duplicates
      if (prev.some((n) => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev].slice(0, 50); // Keep max 50 notifications
    });
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}
