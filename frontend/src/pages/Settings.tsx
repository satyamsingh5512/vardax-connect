import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Shield, Bell, Database } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="min-h-full bg-gradient-to-br from-enterprise-bg via-enterprise-surface/30 to-enterprise-bg p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-enterprise-text mb-2">
            System Settings
          </h1>
          <p className="text-enterprise-text-secondary">
            Configure system preferences and security policies
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center shadow-glow-primary mb-6">
            <SettingsIcon className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-enterprise-text mb-4">
            Advanced Configuration
          </h2>
          
          <p className="text-enterprise-text-secondary mb-8 max-w-2xl mx-auto">
            Comprehensive system configuration including user management, 
            security policies, integrations, and system preferences.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <User className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">User Management</h3>
              <p className="text-sm text-enterprise-text-muted">
                Roles, permissions, and access control
              </p>
            </div>
            
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Shield className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">Security Policies</h3>
              <p className="text-sm text-enterprise-text-muted">
                Authentication and authorization settings
              </p>
            </div>
            
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Bell className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">Notifications</h3>
              <p className="text-sm text-enterprise-text-muted">
                Alert preferences and integrations
              </p>
            </div>
            
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Database className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">Data Management</h3>
              <p className="text-sm text-enterprise-text-muted">
                Backup, retention, and archival policies
              </p>
            </div>
          </div>

          <div className="mt-8">
            <span className="inline-flex items-center px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-brand-primary text-sm font-medium">
              Coming Soon in v2.2.0
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Settings;