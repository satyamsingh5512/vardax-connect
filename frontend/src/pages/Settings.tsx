import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Database,
  Server,
  Globe,
  Mail,
  Slack,
  Webhook,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import { z } from 'zod';
import { FormSystem } from '../components/advanced/FormSystem';
import { Modal, ConfirmationModal } from '../components/advanced/ModalSystem';
import { showToast } from '../components/advanced/NotificationSystem';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'inactive';
  lastLogin: Date;
  createdAt: Date;
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  settings: Record<string, any>;
}

interface Integration {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'siem';
  enabled: boolean;
  config: Record<string, any>;
  lastSync?: Date;
}

// Validation schemas
const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'analyst', 'viewer']),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

const securityPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().min(1, 'Description is required'),
  enabled: z.boolean(),
  maxLoginAttempts: z.number().min(1).max(10),
  sessionTimeout: z.number().min(5).max(1440),
  passwordMinLength: z.number().min(6).max(32),
  requireMFA: z.boolean(),
});

const integrationSchema = z.object({
  name: z.string().min(1, 'Integration name is required'),
  type: z.enum(['email', 'slack', 'webhook', 'siem']),
  enabled: z.boolean(),
  endpoint: z.string().url('Invalid URL').optional(),
  apiKey: z.string().optional(),
  channel: z.string().optional(),
});

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'security' | 'notifications' | 'integrations' | 'backup'>('general');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'user' | 'policy' | 'integration' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: string; item: any }>({ isOpen: false, type: '', item: null });

  // Mock data
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      username: 'admin',
      email: 'admin@vardax.com',
      role: 'admin',
      status: 'active',
      lastLogin: new Date(),
      createdAt: new Date('2024-01-01')
    },
    {
      id: '2',
      username: 'analyst1',
      email: 'analyst@vardax.com',
      role: 'analyst',
      status: 'active',
      lastLogin: new Date(Date.now() - 86400000),
      createdAt: new Date('2024-01-15')
    }
  ]);

  const [securityPolicies, setSecurityPolicies] = useState<SecurityPolicy[]>([
    {
      id: '1',
      name: 'Default Security Policy',
      description: 'Standard security settings for all users',
      enabled: true,
      settings: {
        maxLoginAttempts: 5,
        sessionTimeout: 60,
        passwordMinLength: 8,
        requireMFA: false
      }
    },
    {
      id: '2',
      name: 'High Security Policy',
      description: 'Enhanced security for admin users',
      enabled: false,
      settings: {
        maxLoginAttempts: 3,
        sessionTimeout: 30,
        passwordMinLength: 12,
        requireMFA: true
      }
    }
  ]);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: '1',
      name: 'Email Alerts',
      type: 'email',
      enabled: true,
      config: {
        smtp: 'smtp.gmail.com',
        port: 587,
        username: 'alerts@vardax.com'
      },
      lastSync: new Date()
    },
    {
      id: '2',
      name: 'Slack Notifications',
      type: 'slack',
      enabled: false,
      config: {
        webhook: 'https://hooks.slack.com/...',
        channel: '#security-alerts'
      }
    }
  ]);

  const [systemSettings, setSystemSettings] = useState({
    systemName: 'VARDAx Security Platform',
    timezone: 'UTC',
    logLevel: 'INFO',
    maxLogSize: 100,
    autoBackup: true,
    backupRetention: 30,
    maintenanceMode: false,
    apiRateLimit: 1000,
    maxConcurrentSessions: 100
  });

  // Handlers
  const handleSaveUser = async (data: any) => {
    if (selectedItem) {
      setUsers(prev => prev.map(u => u.id === selectedItem.id ? { ...u, ...data } : u));
      showToast.success('User updated successfully');
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        ...data,
        status: 'active',
        lastLogin: new Date(),
        createdAt: new Date()
      };
      setUsers(prev => [...prev, newUser]);
      showToast.success('User created successfully');
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleSavePolicy = async (data: any) => {
    if (selectedItem) {
      setSecurityPolicies(prev => prev.map(p => p.id === selectedItem.id ? { ...p, ...data, settings: data } : p));
      showToast.success('Security policy updated successfully');
    } else {
      const newPolicy: SecurityPolicy = {
        id: Date.now().toString(),
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        settings: data
      };
      setSecurityPolicies(prev => [...prev, newPolicy]);
      showToast.success('Security policy created successfully');
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleSaveIntegration = async (data: any) => {
    if (selectedItem) {
      setIntegrations(prev => prev.map(i => i.id === selectedItem.id ? { ...i, ...data, config: data } : i));
      showToast.success('Integration updated successfully');
    } else {
      const newIntegration: Integration = {
        id: Date.now().toString(),
        ...data,
        config: data,
        lastSync: new Date()
      };
      setIntegrations(prev => [...prev, newIntegration]);
      showToast.success('Integration created successfully');
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleDelete = (type: string, item: any) => {
    setConfirmModal({ isOpen: true, type, item });
  };

  const confirmDelete = () => {
    const { type, item } = confirmModal;
    
    switch (type) {
      case 'user':
        setUsers(prev => prev.filter(u => u.id !== item.id));
        showToast.success('User deleted successfully');
        break;
      case 'policy':
        setSecurityPolicies(prev => prev.filter(p => p.id !== item.id));
        showToast.success('Security policy deleted successfully');
        break;
      case 'integration':
        setIntegrations(prev => prev.filter(i => i.id !== item.id));
        showToast.success('Integration deleted successfully');
        break;
    }
    
    setConfirmModal({ isOpen: false, type: '', item: null });
  };

  const openModal = (type: 'user' | 'policy' | 'integration', item?: any) => {
    setModalType(type);
    setSelectedItem(item || null);
    setIsModalOpen(true);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'users', label: 'Users', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'backup', label: 'Backup', icon: Database },
  ];

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

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64">
            <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-brand-primary text-white'
                          : 'text-enterprise-text-secondary hover:bg-enterprise-elevated hover:text-enterprise-text'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'general' && (
                  <motion.div
                    key="general"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-xl font-semibold text-enterprise-text mb-6">General Settings</h2>
                    <FormSystem
                      config={{
                        title: 'System Configuration',
                        fields: [
                          {
                            name: 'systemName',
                            label: 'System Name',
                            type: 'text',
                            required: true,
                            placeholder: 'Enter system name'
                          },
                          {
                            name: 'timezone',
                            label: 'Timezone',
                            type: 'select',
                            required: true,
                            options: [
                              { value: 'UTC', label: 'UTC' },
                              { value: 'America/New_York', label: 'Eastern Time' },
                              { value: 'America/Los_Angeles', label: 'Pacific Time' },
                              { value: 'Europe/London', label: 'London' },
                              { value: 'Asia/Tokyo', label: 'Tokyo' }
                            ]
                          },
                          {
                            name: 'logLevel',
                            label: 'Log Level',
                            type: 'select',
                            required: true,
                            options: [
                              { value: 'DEBUG', label: 'Debug' },
                              { value: 'INFO', label: 'Info' },
                              { value: 'WARNING', label: 'Warning' },
                              { value: 'ERROR', label: 'Error' }
                            ]
                          },
                          {
                            name: 'maxLogSize',
                            label: 'Max Log Size (MB)',
                            type: 'number',
                            min: 10,
                            max: 1000
                          },
                          {
                            name: 'apiRateLimit',
                            label: 'API Rate Limit (requests/hour)',
                            type: 'number',
                            min: 100,
                            max: 10000
                          },
                          {
                            name: 'maxConcurrentSessions',
                            label: 'Max Concurrent Sessions',
                            type: 'number',
                            min: 10,
                            max: 1000
                          },
                          {
                            name: 'maintenanceMode',
                            label: 'Maintenance Mode',
                            type: 'switch',
                            description: 'Enable maintenance mode to restrict access'
                          }
                        ],
                        onSubmit: async (data) => {
                          setSystemSettings(prev => ({ ...prev, ...data }));
                          showToast.success('System settings updated successfully');
                        }
                      }}
                      initialValues={systemSettings}
                    />
                  </motion.div>
                )}

                {activeTab === 'users' && (
                  <motion.div
                    key="users"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-enterprise-text">User Management</h2>
                      <button
                        onClick={() => openModal('user')}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add User
                      </button>
                    </div>

                    <div className="space-y-4">
                      {users.map((user) => (
                        <div key={user.id} className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-medium text-enterprise-text">{user.username}</h3>
                                <p className="text-sm text-enterprise-text-secondary">{user.email}</p>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                    user.role === 'analyst' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {user.role}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {user.status}
                                  </span>
                                  <span className="text-xs text-enterprise-text-muted">
                                    Last login: {user.lastLogin.toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openModal('user', user)}
                                className="p-2 text-enterprise-text-secondary hover:text-brand-primary transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete('user', user)}
                                className="p-2 text-enterprise-text-secondary hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-enterprise-text">Security Policies</h2>
                      <button
                        onClick={() => openModal('policy')}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Policy
                      </button>
                    </div>

                    <div className="space-y-4">
                      {securityPolicies.map((policy) => (
                        <div key={policy.id} className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                policy.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'
                              }`}>
                                <Shield className={`w-5 h-5 ${policy.enabled ? 'text-green-400' : 'text-gray-400'}`} />
                              </div>
                              <div>
                                <h3 className="font-medium text-enterprise-text">{policy.name}</h3>
                                <p className="text-sm text-enterprise-text-secondary">{policy.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-enterprise-text-muted">
                                  <span>Max attempts: {policy.settings.maxLoginAttempts}</span>
                                  <span>Session timeout: {policy.settings.sessionTimeout}min</span>
                                  <span>Min password: {policy.settings.passwordMinLength} chars</span>
                                  <span>MFA: {policy.settings.requireMFA ? 'Required' : 'Optional'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openModal('policy', policy)}
                                className="p-2 text-enterprise-text-secondary hover:text-brand-primary transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete('policy', policy)}
                                className="p-2 text-enterprise-text-secondary hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-xl font-semibold text-enterprise-text mb-6">Notification Settings</h2>
                    <FormSystem
                      config={{
                        title: 'Alert Configuration',
                        fields: [
                          {
                            name: 'emailAlerts',
                            label: 'Email Alerts',
                            type: 'switch',
                            description: 'Send security alerts via email'
                          },
                          {
                            name: 'slackAlerts',
                            label: 'Slack Notifications',
                            type: 'switch',
                            description: 'Send notifications to Slack channels'
                          },
                          {
                            name: 'webhookAlerts',
                            label: 'Webhook Notifications',
                            type: 'switch',
                            description: 'Send alerts to external webhooks'
                          },
                          {
                            name: 'alertThreshold',
                            label: 'Alert Threshold',
                            type: 'select',
                            options: [
                              { value: 'low', label: 'Low - All events' },
                              { value: 'medium', label: 'Medium - Important events' },
                              { value: 'high', label: 'High - Critical events only' }
                            ]
                          },
                          {
                            name: 'alertFrequency',
                            label: 'Alert Frequency (minutes)',
                            type: 'slider',
                            min: 1,
                            max: 60,
                            step: 1,
                            description: 'Minimum time between similar alerts'
                          },
                          {
                            name: 'recipients',
                            label: 'Alert Recipients',
                            type: 'textarea',
                            placeholder: 'Enter email addresses, one per line',
                            description: 'Email addresses to receive security alerts'
                          }
                        ],
                        onSubmit: async () => {
                          showToast.success('Notification settings updated successfully');
                        }
                      }}
                      initialValues={{
                        emailAlerts: true,
                        slackAlerts: false,
                        webhookAlerts: false,
                        alertThreshold: 'medium',
                        alertFrequency: 5,
                        recipients: 'admin@vardax.com\nsecurity@vardax.com'
                      }}
                    />
                  </motion.div>
                )}

                {activeTab === 'integrations' && (
                  <motion.div
                    key="integrations"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-enterprise-text">Integrations</h2>
                      <button
                        onClick={() => openModal('integration')}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Integration
                      </button>
                    </div>

                    <div className="space-y-4">
                      {integrations.map((integration) => {
                        const getIcon = (type: string) => {
                          switch (type) {
                            case 'email': return Mail;
                            case 'slack': return Slack;
                            case 'webhook': return Webhook;
                            case 'siem': return Server;
                            default: return Globe;
                          }
                        };
                        const Icon = getIcon(integration.type);

                        return (
                          <div key={integration.id} className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  integration.enabled ? 'bg-green-500/20' : 'bg-gray-500/20'
                                }`}>
                                  <Icon className={`w-5 h-5 ${integration.enabled ? 'text-green-400' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                  <h3 className="font-medium text-enterprise-text">{integration.name}</h3>
                                  <p className="text-sm text-enterprise-text-secondary capitalize">{integration.type} Integration</p>
                                  {integration.lastSync && (
                                    <p className="text-xs text-enterprise-text-muted">
                                      Last sync: {integration.lastSync.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openModal('integration', integration)}
                                  className="p-2 text-enterprise-text-secondary hover:text-brand-primary transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete('integration', integration)}
                                  className="p-2 text-enterprise-text-secondary hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'backup' && (
                  <motion.div
                    key="backup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-xl font-semibold text-enterprise-text mb-6">Backup & Recovery</h2>
                    <FormSystem
                      config={{
                        title: 'Backup Configuration',
                        fields: [
                          {
                            name: 'autoBackup',
                            label: 'Automatic Backup',
                            type: 'switch',
                            description: 'Enable automatic daily backups'
                          },
                          {
                            name: 'backupRetention',
                            label: 'Backup Retention (days)',
                            type: 'number',
                            min: 7,
                            max: 365,
                            description: 'Number of days to keep backup files'
                          },
                          {
                            name: 'backupLocation',
                            label: 'Backup Location',
                            type: 'select',
                            options: [
                              { value: 'local', label: 'Local Storage' },
                              { value: 's3', label: 'Amazon S3' },
                              { value: 'gcs', label: 'Google Cloud Storage' },
                              { value: 'azure', label: 'Azure Blob Storage' }
                            ]
                          },
                          {
                            name: 'encryptBackups',
                            label: 'Encrypt Backups',
                            type: 'switch',
                            description: 'Encrypt backup files with AES-256'
                          },
                          {
                            name: 'backupSchedule',
                            label: 'Backup Schedule',
                            type: 'select',
                            options: [
                              { value: 'daily', label: 'Daily at 2:00 AM' },
                              { value: 'weekly', label: 'Weekly on Sunday' },
                              { value: 'monthly', label: 'Monthly on 1st' }
                            ]
                          }
                        ],
                        onSubmit: async () => {
                          showToast.success('Backup settings updated successfully');
                        }
                      }}
                      initialValues={{
                        autoBackup: true,
                        backupRetention: 30,
                        backupLocation: 'local',
                        encryptBackups: true,
                        backupSchedule: 'daily'
                      }}
                    />

                    <div className="mt-8 p-4 bg-enterprise-elevated border border-enterprise-border-light rounded-lg">
                      <h3 className="font-medium text-enterprise-text mb-4">Manual Backup</h3>
                      <p className="text-sm text-enterprise-text-secondary mb-4">
                        Create an immediate backup of all system data and configurations.
                      </p>
                      <button className="btn btn-primary flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Create Backup Now
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
          setModalType(null);
        }}
        title={
          modalType === 'user' ? (selectedItem ? 'Edit User' : 'Add User') :
          modalType === 'policy' ? (selectedItem ? 'Edit Security Policy' : 'Add Security Policy') :
          modalType === 'integration' ? (selectedItem ? 'Edit Integration' : 'Add Integration') :
          'Settings'
        }
        size="lg"
      >
        {modalType === 'user' && (
          <FormSystem
            config={{
              title: selectedItem ? 'Edit User' : 'Create New User',
              fields: [
                {
                  name: 'username',
                  label: 'Username',
                  type: 'text',
                  required: true,
                  placeholder: 'Enter username'
                },
                {
                  name: 'email',
                  label: 'Email',
                  type: 'email',
                  required: true,
                  placeholder: 'Enter email address'
                },
                {
                  name: 'role',
                  label: 'Role',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'admin', label: 'Administrator' },
                    { value: 'analyst', label: 'Security Analyst' },
                    { value: 'viewer', label: 'Viewer' }
                  ]
                },
                ...(selectedItem ? [] : [{
                  name: 'password',
                  label: 'Password',
                  type: 'password' as const,
                  required: true,
                  placeholder: 'Enter password'
                }])
              ],
              schema: userSchema,
              onSubmit: handleSaveUser
            }}
            initialValues={selectedItem || {}}
          />
        )}

        {modalType === 'policy' && (
          <FormSystem
            config={{
              title: selectedItem ? 'Edit Security Policy' : 'Create Security Policy',
              fields: [
                {
                  name: 'name',
                  label: 'Policy Name',
                  type: 'text',
                  required: true,
                  placeholder: 'Enter policy name'
                },
                {
                  name: 'description',
                  label: 'Description',
                  type: 'textarea',
                  required: true,
                  placeholder: 'Enter policy description'
                },
                {
                  name: 'enabled',
                  label: 'Enable Policy',
                  type: 'switch'
                },
                {
                  name: 'maxLoginAttempts',
                  label: 'Max Login Attempts',
                  type: 'number',
                  min: 1,
                  max: 10,
                  required: true
                },
                {
                  name: 'sessionTimeout',
                  label: 'Session Timeout (minutes)',
                  type: 'number',
                  min: 5,
                  max: 1440,
                  required: true
                },
                {
                  name: 'passwordMinLength',
                  label: 'Minimum Password Length',
                  type: 'number',
                  min: 6,
                  max: 32,
                  required: true
                },
                {
                  name: 'requireMFA',
                  label: 'Require Multi-Factor Authentication',
                  type: 'switch'
                }
              ],
              schema: securityPolicySchema,
              onSubmit: handleSavePolicy
            }}
            initialValues={selectedItem ? { ...selectedItem, ...selectedItem.settings } : { enabled: true, maxLoginAttempts: 5, sessionTimeout: 60, passwordMinLength: 8, requireMFA: false }}
          />
        )}

        {modalType === 'integration' && (
          <FormSystem
            config={{
              title: selectedItem ? 'Edit Integration' : 'Create Integration',
              fields: [
                {
                  name: 'name',
                  label: 'Integration Name',
                  type: 'text',
                  required: true,
                  placeholder: 'Enter integration name'
                },
                {
                  name: 'type',
                  label: 'Integration Type',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'email', label: 'Email' },
                    { value: 'slack', label: 'Slack' },
                    { value: 'webhook', label: 'Webhook' },
                    { value: 'siem', label: 'SIEM' }
                  ]
                },
                {
                  name: 'enabled',
                  label: 'Enable Integration',
                  type: 'switch'
                },
                {
                  name: 'endpoint',
                  label: 'Endpoint URL',
                  type: 'text',
                  placeholder: 'https://api.example.com/webhook'
                },
                {
                  name: 'apiKey',
                  label: 'API Key',
                  type: 'password',
                  placeholder: 'Enter API key'
                },
                {
                  name: 'channel',
                  label: 'Channel/Destination',
                  type: 'text',
                  placeholder: 'e.g., #security-alerts'
                }
              ],
              schema: integrationSchema,
              onSubmit: handleSaveIntegration
            }}
            initialValues={selectedItem ? { ...selectedItem, ...selectedItem.config } : { enabled: true }}
          />
        )}
      </Modal>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: '', item: null })}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this ${confirmModal.type}? This action cannot be undone.`}
        type="error"
      />
    </div>
  );
};

export default Settings;