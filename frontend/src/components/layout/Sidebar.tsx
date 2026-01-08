import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  BarChart3, 
  Settings, 
  FileText, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: string | number;
  description?: string;
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Security Overview',
    icon: Shield,
    path: '/dashboard',
    description: 'Real-time security monitoring'
  },
  {
    id: 'threats',
    label: 'Threat Intelligence',
    icon: AlertTriangle,
    path: '/threats',
    badge: 'Live',
    description: 'Active threats and anomalies'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
    description: 'Security metrics and insights'
  },
  {
    id: 'rules',
    label: 'Rule Management',
    icon: Layers,
    path: '/rules',
    badge: 3,
    description: 'WAF rules and policies'
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    path: '/reports',
    description: 'Security reports and compliance'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    description: 'System configuration'
  }
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();

  return (
    <motion.div
      className={clsx(
        'h-full bg-enterprise-surface/80 backdrop-blur-xl border-r border-enterprise-border',
        'flex flex-col relative transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-enterprise-border/50">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center shadow-glow-primary">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-enterprise-text">VARDAx</h1>
                <p className="text-xs text-enterprise-text-muted">Security Platform</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Button */}
        <motion.button
          onClick={onToggle}
          className={clsx(
            'p-2 rounded-lg bg-enterprise-card hover:bg-enterprise-hover',
            'border border-enterprise-border-light transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-primary/50',
            collapsed && 'mx-auto'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-enterprise-text-secondary" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-enterprise-text-secondary" />
          )}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center rounded-xl transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-brand-primary/50',
                    collapsed ? 'p-3 justify-center' : 'p-3',
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-glow-primary'
                      : 'text-enterprise-text-secondary hover:text-enterprise-text hover:bg-enterprise-hover border border-transparent'
                  )
                }
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-primary rounded-r-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <div className={clsx('flex-shrink-0', !collapsed && 'mr-3')}>
                  <Icon 
                    className={clsx(
                      'w-5 h-5 transition-colors duration-200',
                      isActive ? 'text-brand-primary' : 'text-current'
                    )} 
                  />
                </div>

                {/* Label and Badge */}
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex items-center justify-between min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-xs text-enterprise-text-muted truncate mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Badge */}
                      {item.badge && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={clsx(
                            'ml-2 px-2 py-0.5 rounded-full text-xs font-medium',
                            typeof item.badge === 'string'
                              ? 'bg-status-success/20 text-status-success border border-status-success/30'
                              : 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
                          )}
                        >
                          {item.badge}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-enterprise-elevated text-enterprise-text text-sm rounded-lg shadow-enterprise-lg border border-enterprise-border-light opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-enterprise-elevated border-l border-t border-enterprise-border-light rotate-45" />
                  </div>
                )}
              </NavLink>
            </motion.div>
          );
        })}
      </nav>

      {/* Status Indicator */}
      <div className="p-4 border-t border-enterprise-border/50">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center space-x-3 p-3 bg-enterprise-card rounded-lg border border-enterprise-border-light"
            >
              <div className="relative">
                <div className="w-3 h-3 bg-status-success rounded-full animate-pulse-glow" />
                <div className="absolute inset-0 w-3 h-3 bg-status-success rounded-full animate-ping opacity-75" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-enterprise-text">System Online</p>
                <p className="text-xs text-enterprise-text-muted">All services operational</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="w-3 h-3 bg-status-success rounded-full animate-pulse-glow" />
                <div className="absolute inset-0 w-3 h-3 bg-status-success rounded-full animate-ping opacity-75" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Sidebar;