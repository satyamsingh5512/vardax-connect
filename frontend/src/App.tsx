import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoadingScreen from './components/common/LoadingScreen';

// Advanced Components
import { CommandPalette } from './components/advanced/CommandPalette';
import { useNotifications, createNotification } from './components/advanced/NotificationSystem';
import { useModalManager } from './components/advanced/ModalSystem';

// Page Components
import Dashboard from './pages/Dashboard';
import ThreatIntelligence from './pages/ThreatIntelligence';
import Analytics from './pages/Analytics';
import RuleManagement from './pages/RuleManagement';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

// Store
import { useStore } from './store';

// Types
interface AppState {
  isLoading: boolean;
  sidebarCollapsed: boolean;
  currentPage: string;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    isLoading: true,
    sidebarCollapsed: false,
    currentPage: 'dashboard'
  });

  const { isConnected, connectionStatus } = useStore();
  const notifications = useNotifications();
  const modalManager = useModalManager();

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      // Simulate initialization process
      await new Promise(resolve => setTimeout(resolve, 2000));
      setAppState(prev => ({ ...prev, isLoading: false }));
      
      // Add demo notifications
      setTimeout(() => {
        notifications.addNotification(createNotification(
          'security',
          'New Threat Detected',
          'Suspicious activity from IP 192.168.1.100',
          {
            persistent: true,
            action: {
              label: 'Investigate',
              onClick: () => console.log('Investigating threat...')
            }
          }
        ));
        
        notifications.addNotification(createNotification(
          'success',
          'System Update Complete',
          'All security modules have been updated successfully'
        ));
      }, 1000);
    };

    initializeApp();
  }, []);

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setAppState(prev => ({ 
      ...prev, 
      sidebarCollapsed: !prev.sidebarCollapsed 
    }));
  };

  // Show loading screen during initialization
  if (appState.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-enterprise-bg text-enterprise-text font-sans">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-gradient-mesh opacity-30 pointer-events-none" />
        <div className="fixed inset-0 bg-gradient-radial from-brand-primary/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Main Layout */}
        <div className="relative flex h-screen overflow-hidden">
          {/* Sidebar */}
          <AnimatePresence mode="wait">
            <motion.div
              key={appState.sidebarCollapsed ? 'collapsed' : 'expanded'}
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={`
                ${appState.sidebarCollapsed ? 'w-16' : 'w-64'} 
                flex-shrink-0 transition-all duration-300 ease-in-out
              `}
            >
              <Sidebar 
                collapsed={appState.sidebarCollapsed}
                onToggle={toggleSidebar}
              />
            </motion.div>
          </AnimatePresence>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Header 
                onToggleSidebar={toggleSidebar}
                connectionStatus={connectionStatus}
              />
            </motion.div>

            {/* Page Content */}
            <main className="flex-1 overflow-auto bg-enterprise-surface/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="h-full"
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/threats" element={<ThreatIntelligence />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/rules" element={<RuleManagement />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </motion.div>
            </main>
          </div>
        </div>

        {/* Advanced Components */}
        <CommandPalette />
        <modalManager.ModalContainer />

        {/* Connection Status Indicator */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-4 right-4 z-50"
            >
              <div className="bg-status-error/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-enterprise-lg border border-status-error/20">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Connection Lost</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1d23',
              color: '#ffffff',
              border: '1px solid #2d323c',
              borderRadius: '0.75rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            },
          }}
        />

        {/* Global Keyboard Shortcuts */}
        <GlobalKeyboardShortcuts onToggleSidebar={toggleSidebar} />
      </div>
    </Router>
  );
};

// Global Keyboard Shortcuts Component
const GlobalKeyboardShortcuts: React.FC<{ onToggleSidebar: () => void }> = ({ 
  onToggleSidebar 
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + B to toggle sidebar
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        onToggleSidebar();
      }
      
      // Cmd/Ctrl + K for command palette (future feature)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        // TODO: Open command palette
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSidebar]);

  return null;
};

export default App;