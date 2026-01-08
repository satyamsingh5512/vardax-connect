import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Info, 
  X,
  Bell,
  Shield
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'security';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const notificationIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  security: Shield,
};

const notificationColors = {
  success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  security: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

export function NotificationSystem({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll
}: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenu.Trigger asChild>
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-0 max-h-96 overflow-hidden"
            sideOffset={5}
            align="end"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClearAll}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <AnimatePresence>
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={onMarkAsRead}
                      onDismiss={onDismiss}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(15 23 42)',
            border: '1px solid rgb(51 65 85)',
            color: 'white',
          },
        }}
      />
    </>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const Icon = notificationIcons[notification.type];
  const colorClass = notificationColors[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`p-4 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer ${
        !notification.read ? 'bg-slate-800/30' : ''
      }`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1 rounded-full ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h4 className={`font-medium ${!notification.read ? 'text-white' : 'text-slate-300'}`}>
              {notification.title}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notification.id);
              }}
              className="text-slate-400 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {notification.timestamp.toLocaleTimeString()}
            </span>
            {notification.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  notification.action!.onClick();
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {notification.action.label}
              </button>
            )}
          </div>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
        )}
      </div>
    </motion.div>
  );
}

// Utility functions for creating notifications
export const createNotification = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Partial<Notification>
): Notification => ({
  id: Math.random().toString(36).substr(2, 9),
  type,
  title,
  message,
  timestamp: new Date(),
  read: false,
  ...options,
});

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  warning: (message: string) => toast.warning(message),
  info: (message: string) => toast.info(message),
  security: (message: string) => toast(message, {
    icon: <Shield className="w-4 h-4 text-purple-400" />,
  }),
};

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    
    // Auto-dismiss non-persistent notifications after 5 seconds
    if (!notification.persistent) {
      setTimeout(() => {
        dismissNotification(notification.id);
      }, 5000);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  };
}