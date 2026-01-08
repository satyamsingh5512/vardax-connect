import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Bell, 
  User, 
  Settings, 
  LogOut, 
  Menu,
  Wifi,
  WifiOff,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '../../store';

interface HeaderProps {
  onToggleSidebar: () => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

interface NotificationItem {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  onToggleSidebar, 
  connectionStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [demoNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      type: 'critical',
      title: 'High Severity Threat Detected',
      message: 'SQL injection attempt from IP 192.168.1.100',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false
    },
    {
      id: '2',
      type: 'warning',
      title: 'Unusual Traffic Pattern',
      message: 'Traffic spike detected on /api/login endpoint',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false
    },
    {
      id: '3',
      type: 'success',
      title: 'Rule Deployed Successfully',
      message: 'New WAF rule #4521 is now active',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: true
    }
  ]);

  const { stats } = useStore();
  const unreadCount = demoNotifications.filter((n: NotificationItem) => !n.read).length;

  // Real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-status-success" />;
      case 'connecting':
        return <Activity className="w-4 h-4 text-status-warning animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-status-error" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-severity-critical" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-severity-medium" />;
      case 'info':
        return <AlertCircle className="w-4 h-4 text-severity-info" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-status-success" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-16 bg-enterprise-surface/90 backdrop-blur-xl border-b border-enterprise-border flex items-center justify-between px-6 relative z-40"
    >
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-enterprise-hover transition-colors duration-200"
        >
          <Menu className="w-5 h-5 text-enterprise-text-secondary" />
        </button>

        {/* Search Bar */}
        <div className="relative">
          <motion.div
            initial={{ width: 200 }}
            whileFocus={{ width: 300 }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-enterprise-text-muted" />
            <input
              type="text"
              placeholder="Search threats, rules, IPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'w-full pl-10 pr-4 py-2 bg-enterprise-card border border-enterprise-border-light rounded-lg',
                'text-enterprise-text placeholder-enterprise-text-muted',
                'focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50',
                'transition-all duration-200'
              )}
            />
          </motion.div>
        </div>

        {/* Quick Stats */}
        <div className="hidden md:flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-status-success rounded-full animate-pulse" />
            <span className="text-sm text-enterprise-text-secondary">
              {stats.requestsPerSecond.toFixed(1)} req/s
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-severity-medium rounded-full animate-pulse" />
            <span className="text-sm text-enterprise-text-secondary">
              {stats.anomalyRate.toFixed(1)}% anomalies
            </span>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-enterprise-card rounded-lg border border-enterprise-border-light"
        >
          {getConnectionIcon()}
          <span className="text-sm text-enterprise-text-secondary">
            {getConnectionText()}
          </span>
        </motion.div>

        {/* Current Time */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-enterprise-card rounded-lg border border-enterprise-border-light">
          <Clock className="w-4 h-4 text-enterprise-text-muted" />
          <span className="text-sm text-enterprise-text-secondary font-mono">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>

        {/* Notifications */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-2 rounded-lg hover:bg-enterprise-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            >
              <Bell className="w-5 h-5 text-enterprise-text-secondary" />
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-severity-critical text-white text-xs font-bold rounded-full flex items-center justify-center"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.div>
              )}
            </motion.button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="w-80 bg-enterprise-elevated border border-enterprise-border-light rounded-xl shadow-enterprise-xl p-2 z-50"
              sideOffset={8}
              align="end"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <div className="px-3 py-2 border-b border-enterprise-border-light">
                  <h3 className="font-semibold text-enterprise-text">Notifications</h3>
                  <p className="text-sm text-enterprise-text-muted">
                    {unreadCount} unread notifications
                  </p>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1">
                  {demoNotifications.map((notification: NotificationItem) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={clsx(
                        'p-3 rounded-lg cursor-pointer transition-colors duration-200',
                        notification.read 
                          ? 'bg-enterprise-card/50 hover:bg-enterprise-hover' 
                          : 'bg-enterprise-card hover:bg-enterprise-hover'
                      )}
                    >
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className={clsx(
                            'text-sm font-medium',
                            notification.read ? 'text-enterprise-text-muted' : 'text-enterprise-text'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-enterprise-text-muted mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-enterprise-text-muted mt-2">
                            {formatTimeAgo(notification.timestamp)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="px-3 py-2 border-t border-enterprise-border-light">
                  <button className="w-full text-sm text-brand-primary hover:text-brand-primary-hover transition-colors duration-200">
                    View all notifications
                  </button>
                </div>
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* User Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-enterprise-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-enterprise-text">Admin</p>
                <p className="text-xs text-enterprise-text-muted">Security Analyst</p>
              </div>
            </motion.button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="w-56 bg-enterprise-elevated border border-enterprise-border-light rounded-xl shadow-enterprise-xl p-2 z-50"
              sideOffset={8}
              align="end"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <DropdownMenu.Item className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-enterprise-hover cursor-pointer focus:outline-none">
                  <User className="w-4 h-4 text-enterprise-text-secondary" />
                  <span className="text-sm text-enterprise-text">Profile</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-enterprise-hover cursor-pointer focus:outline-none">
                  <Settings className="w-4 h-4 text-enterprise-text-secondary" />
                  <span className="text-sm text-enterprise-text">Settings</span>
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-enterprise-border-light my-2" />

                <DropdownMenu.Item className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-status-error/10 cursor-pointer focus:outline-none">
                  <LogOut className="w-4 h-4 text-status-error" />
                  <span className="text-sm text-status-error">Sign out</span>
                </DropdownMenu.Item>
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.header>
  );
};

export default Header;