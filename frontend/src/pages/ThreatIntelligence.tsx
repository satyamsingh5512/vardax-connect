import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Globe, Activity } from 'lucide-react';

const ThreatIntelligence: React.FC = () => {
  return (
    <div className="min-h-full bg-gradient-to-br from-enterprise-bg via-enterprise-surface/30 to-enterprise-bg p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-enterprise-text mb-2">
            Threat Intelligence
          </h1>
          <p className="text-enterprise-text-secondary">
            Advanced threat detection and analysis platform
          </p>
        </div>

        {/* Coming Soon Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center shadow-glow-primary mb-6">
            <AlertTriangle className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-enterprise-text mb-4">
            Advanced Threat Intelligence
          </h2>
          
          <p className="text-enterprise-text-secondary mb-8 max-w-2xl mx-auto">
            This page will feature comprehensive threat intelligence capabilities including 
            real-time threat feeds, attack pattern analysis, IOC management, and threat hunting tools.
          </p>

          {/* Feature Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Shield className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">IOC Management</h3>
              <p className="text-sm text-enterprise-text-muted">
                Manage indicators of compromise and threat signatures
              </p>
            </div>
            
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Globe className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">Threat Feeds</h3>
              <p className="text-sm text-enterprise-text-muted">
                Real-time threat intelligence from global sources
              </p>
            </div>
            
            <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-6">
              <Activity className="w-8 h-8 text-brand-primary mx-auto mb-4" />
              <h3 className="font-semibold text-enterprise-text mb-2">Threat Hunting</h3>
              <p className="text-sm text-enterprise-text-muted">
                Proactive threat hunting and investigation tools
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

export default ThreatIntelligence;