import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Activity, CheckCircle } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
}

const loadingSteps: LoadingStep[] = [
  {
    id: 'security',
    label: 'Initializing Security Protocols',
    icon: Shield,
    duration: 800
  },
  {
    id: 'authentication',
    label: 'Verifying Authentication',
    icon: Lock,
    duration: 600
  },
  {
    id: 'services',
    label: 'Starting Security Services',
    icon: Activity,
    duration: 700
  },
  {
    id: 'complete',
    label: 'System Ready',
    icon: CheckCircle,
    duration: 400
  }
];

const LoadingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep < loadingSteps.length - 1) {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        setCurrentStep(prev => prev + 1);
      } else {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
      }
    }, loadingSteps[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep]);

  const progress = ((currentStep + 1) / loadingSteps.length) * 100;

  return (
    <div className="min-h-screen bg-enterprise-bg flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
      <div className="absolute inset-0 bg-gradient-radial from-brand-primary/10 via-transparent to-transparent" />
      
      {/* Animated Background Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-brand-primary/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Main Loading Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center max-w-md mx-auto px-6"
      >
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center shadow-glow-primary mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-enterprise-text mb-2">VARDAx</h1>
          <p className="text-enterprise-text-secondary">Enterprise Security Platform</p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '100%', opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-8"
        >
          <div className="w-full bg-enterprise-card rounded-full h-2 overflow-hidden border border-enterprise-border-light">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full shadow-glow-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-enterprise-text-muted">
            <span>0%</span>
            <motion.span
              key={progress}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono"
            >
              {Math.round(progress)}%
            </motion.span>
            <span>100%</span>
          </div>
        </motion.div>

        {/* Loading Steps */}
        <div className="space-y-4 mb-8">
          {loadingSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = completedSteps.has(index);
            const isPending = index > currentStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`flex items-center space-x-4 p-4 rounded-xl border transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-primary/10 border-brand-primary/30 shadow-glow-primary'
                    : isCompleted
                    ? 'bg-status-success/10 border-status-success/30'
                    : 'bg-enterprise-card border-enterprise-border-light'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-primary text-white'
                    : isCompleted
                    ? 'bg-status-success text-white'
                    : 'bg-enterprise-hover text-enterprise-text-muted'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    isActive
                      ? 'text-brand-primary'
                      : isCompleted
                      ? 'text-status-success'
                      : isPending
                      ? 'text-enterprise-text-muted'
                      : 'text-enterprise-text'
                  }`}>
                    {step.label}
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="flex-shrink-0">
                  <AnimatePresence mode="wait">
                    {isActive && (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"
                      />
                    )}
                    {isCompleted && (
                      <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <CheckCircle className="w-4 h-4 text-status-success" />
                      </motion.div>
                    )}
                    {isPending && (
                      <motion.div
                        key="pending"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="w-4 h-4 border-2 border-enterprise-border-light rounded-full"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Loading Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-enterprise-text-secondary text-sm"
            >
              {loadingSteps[currentStep]?.label || 'Finalizing...'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Pulse Animation */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-brand-primary/20"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Version Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center"
      >
        <p className="text-xs text-enterprise-text-muted">
          VARDAx Security Platform v2.1.0
        </p>
        <p className="text-xs text-enterprise-text-muted mt-1">
          Enterprise Edition
        </p>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;