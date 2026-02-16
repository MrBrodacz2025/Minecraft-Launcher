import React from 'react';
import { motion } from 'framer-motion';
import { FiX, FiInfo, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiTrash2 } from 'react-icons/fi';

import type { Notification } from '../types';

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onClose,
  onMarkAsRead,
  onClearAll,
}) => {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <FiAlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <FiAlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <FiInfo className="w-5 h-5 text-blue-400" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Przed chwilą';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min temu`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} godz. temu`;
    return new Date(timestamp).toLocaleDateString('pl-PL');
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className="fixed right-0 top-10 bottom-0 w-96 bg-launcher-card border-l border-launcher-border z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-launcher-border">
          <h2 className="font-semibold">Powiadomienia</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
              className="p-2 hover:bg-launcher-cardHover rounded-lg transition-colors"
              title="Wyczyść wszystkie"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-launcher-cardHover rounded-lg transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-launcher-textMuted">
              <FiInfo className="w-12 h-12 mb-4 opacity-50" />
              <p>Brak powiadomień</p>
            </div>
          ) : (
            <div className="divide-y divide-launcher-border">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onMarkAsRead(notification.id)}
                  className={`p-4 hover:bg-launcher-cardHover cursor-pointer transition-colors ${
                    !notification.read ? 'bg-launcher-accent/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm truncate">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-launcher-accent rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-launcher-textMuted mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-launcher-textDim mt-2">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default NotificationPanel;
