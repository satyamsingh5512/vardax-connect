import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricCardProps {
  metric: {
    id: string;
    title: string;
    value: string | number;
    change: number;
    changeType: 'increase' | 'decrease' | 'neutral';
    icon: React.ComponentType<{ className?: string }>;
    color: 'primary' | 'success' | 'warning' | 'error';
    description: string;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const { title, value, change, changeType, icon: Icon, color, description } = metric;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'primary':
        return {
          bg: 'bg-brand-primary/10',
          border: 'border-brand-primary/20',
          icon: 'text-brand-primary',
          glow: 'shadow-glow-primary'
        };
      case 'success':
        return {
          bg: 'bg-status-success/10',
          border: 'border-status-success/20',
          icon: 'text-status-success',
          glow: 'shadow-glow-success'
        };
      case 'warning':
        return {
          bg: 'bg-status-warning/10',
          border: 'border-status-warning/20',
          icon: 'text-status-warning',
          glow: 'shadow-glow-warning'
        };
      case 'error':
        return {
          bg: 'bg-status-error/10',
          border: 'border-status-error/20',
          icon: 'text-status-error',
          glow: 'shadow-glow-error'
        };
      default:
        return {
          bg: 'bg-enterprise-card',
          border: 'border-enterprise-border-light',
          icon: 'text-enterprise-text-muted',
          glow: ''
        };
    }
  };

  const colorClasses = getColorClasses(color);

  const getTrendIcon = () => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4" />;
      case 'neutral':
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case 'increase':
        return change > 0 ? 'text-status-success' : 'text-status-error';
      case 'decrease':
        return change > 0 ? 'text-status-error' : 'text-status-success';
      case 'neutral':
        return 'text-enterprise-text-muted';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'relative bg-enterprise-card/50 backdrop-blur-sm border rounded-xl p-6',
        'hover:bg-enterprise-elevated/50 transition-all duration-300',
        colorClasses.border,
        colorClasses.glow
      )}
    >
      {/* Background Gradient */}
      <div className={clsx('absolute inset-0 rounded-xl opacity-50', colorClasses.bg)} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={clsx(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            colorClasses.bg,
            colorClasses.border,
            'border'
          )}>
            <Icon className={clsx('w-6 h-6', colorClasses.icon)} />
          </div>
          
          {/* Trend Indicator */}
          <div className={clsx(
            'flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium',
            getTrendColor(),
            'bg-enterprise-hover/50'
          )}>
            {getTrendIcon()}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        </div>

        {/* Value */}
        <div className="mb-2">
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl font-bold text-enterprise-text"
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </motion.h3>
        </div>

        {/* Title and Description */}
        <div>
          <h4 className="text-sm font-semibold text-enterprise-text mb-1">
            {title}
          </h4>
          <p className="text-xs text-enterprise-text-muted leading-relaxed">
            {description}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="mt-4">
          <div className="w-full h-1 bg-enterprise-hover rounded-full overflow-hidden">
            <motion.div
              className={clsx('h-full rounded-full', {
                'bg-brand-primary': color === 'primary',
                'bg-status-success': color === 'success',
                'bg-status-warning': color === 'warning',
                'bg-status-error': color === 'error'
              })}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.abs(change) * 2, 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Hover Effect */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 pointer-events-none"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Pulse Animation for Active Metrics */}
      {Math.abs(change) > 10 && (
        <motion.div
          className={clsx('absolute inset-0 rounded-xl border-2 opacity-30', colorClasses.border)}
          animate={{
            scale: [1, 1.02, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
};

export default MetricCard;