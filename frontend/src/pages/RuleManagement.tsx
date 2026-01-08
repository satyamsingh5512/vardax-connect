import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Copy,
  Download,
  Upload,
  Search,
  CheckCircle,
  AlertTriangle,
  Shield,
  Code,
  Eye,
  Zap
} from 'lucide-react';
import { DataTable } from '../components/advanced/DataTable';
import { Modal, ConfirmationModal } from '../components/advanced/ModalSystem';
import { FormSystem, type FormConfig } from '../components/advanced/FormSystem';
import { showToast } from '../components/advanced/NotificationSystem';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';

interface WAFRule {
  id: string;
  name: string;
  description: string;
  ruleContent: string;
  category: 'sql-injection' | 'xss' | 'ddos' | 'brute-force' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive' | 'testing';
  action: 'block' | 'log' | 'challenge';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  matchCount: number;
  falsePositives: number;
  lastTriggered?: Date;
}

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: string[];
}

const RuleManagement: React.FC = () => {
  const [rules, setRules] = useState<WAFRule[]>([]);
  const [filteredRules, setFilteredRules] = useState<WAFRule[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [selectedRule, setSelectedRule] = useState<WAFRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<WAFRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Generate mock WAF rules
  const generateMockRules = (): WAFRule[] => {
    const categories: WAFRule['category'][] = ['sql-injection', 'xss', 'ddos', 'brute-force', 'custom'];
    const severities: WAFRule['severity'][] = ['low', 'medium', 'high', 'critical'];
    const statuses: WAFRule['status'][] = ['active', 'inactive', 'testing'];
    const actions: WAFRule['action'][] = ['block', 'log', 'challenge'];
    
    const ruleNames = [
      'SQL Injection Protection',
      'XSS Attack Prevention',
      'DDoS Rate Limiting',
      'Brute Force Protection',
      'Admin Panel Security',
      'API Rate Limiting',
      'File Upload Validation',
      'Comment Spam Filter',
      'Login Attempt Monitor',
      'Suspicious User Agent Block'
    ];

    return Array.from({ length: 25 }, (_, i) => ({
      id: `rule-${i + 1}`,
      name: ruleNames[i % ruleNames.length] + ` ${Math.floor(i / ruleNames.length) + 1}`,
      description: `Advanced security rule to protect against ${categories[i % categories.length].replace('-', ' ')} attacks`,
      ruleContent: `SecRule ARGS "@detectSQLi" "id:${1000 + i},phase:2,block,msg:'SQL Injection Attack Detected',logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',tag:'application-multi',tag:'language-multi',tag:'platform-multi',tag:'attack-sqli'"`,
      category: categories[i % categories.length],
      severity: severities[i % severities.length],
      status: statuses[i % statuses.length],
      action: actions[i % actions.length],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      createdBy: ['admin', 'security-team', 'ml-engine'][i % 3],
      matchCount: Math.floor(Math.random() * 1000),
      falsePositives: Math.floor(Math.random() * 10),
      lastTriggered: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) : undefined
    }));
  };

  const generateMockTemplates = (): RuleTemplate[] => {
    return [
      {
        id: 'template-1',
        name: 'SQL Injection Basic',
        description: 'Basic SQL injection protection rule',
        category: 'sql-injection',
        content: 'SecRule ARGS "@detectSQLi" "id:{ID},phase:2,{ACTION},msg:\'SQL Injection Attack Detected\'"',
        variables: ['ID', 'ACTION']
      },
      {
        id: 'template-2',
        name: 'XSS Protection',
        description: 'Cross-site scripting protection rule',
        category: 'xss',
        content: 'SecRule ARGS "@detectXSS" "id:{ID},phase:2,{ACTION},msg:\'XSS Attack Detected\'"',
        variables: ['ID', 'ACTION']
      },
      {
        id: 'template-3',
        name: 'Rate Limiting',
        description: 'Basic rate limiting rule',
        category: 'ddos',
        content: 'SecRule IP:REQUEST_COUNT "@gt {LIMIT}" "id:{ID},phase:1,{ACTION},msg:\'Rate limit exceeded\'"',
        variables: ['ID', 'ACTION', 'LIMIT']
      }
    ];
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockRules = generateMockRules();
      setRules(mockRules);
      setFilteredRules(mockRules);
      setTemplates(generateMockTemplates());
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Filter rules
  useEffect(() => {
    let filtered = rules;

    if (searchQuery) {
      filtered = filtered.filter(rule =>
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.ruleContent.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(rule => rule.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(rule => rule.status === statusFilter);
    }

    setFilteredRules(filtered);
  }, [rules, searchQuery, categoryFilter, statusFilter]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sql-injection': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'xss': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'ddos': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'brute-force': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'custom': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'inactive': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'testing': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const handleToggleRule = async (rule: WAFRule) => {
    const newStatus = rule.status === 'active' ? 'inactive' : 'active';
    
    setRules(prev => prev.map(r => 
      r.id === rule.id ? { ...r, status: newStatus, updatedAt: new Date() } : r
    ));

    showToast.success(`Rule ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
  };

  const handleDeleteRule = (rule: WAFRule) => {
    setRuleToDelete(rule);
    setShowDeleteModal(true);
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;

    setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
    showToast.success('Rule deleted successfully');
    setShowDeleteModal(false);
    setRuleToDelete(null);
  };

  const handleDuplicateRule = (rule: WAFRule) => {
    const newRule: WAFRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'inactive',
      matchCount: 0,
      falsePositives: 0,
      lastTriggered: undefined
    };

    setRules(prev => [newRule, ...prev]);
    showToast.success('Rule duplicated successfully');
  };

  // Form configuration for creating/editing rules
  const ruleFormConfig: FormConfig = {
    title: selectedRule ? 'Edit WAF Rule' : 'Create New WAF Rule',
    description: selectedRule ? 'Modify the existing WAF rule configuration' : 'Create a new Web Application Firewall rule',
    fields: [
      {
        name: 'name',
        label: 'Rule Name',
        type: 'text',
        placeholder: 'Enter rule name',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe what this rule does',
        required: true
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: [
          { value: 'sql-injection', label: 'SQL Injection' },
          { value: 'xss', label: 'Cross-Site Scripting' },
          { value: 'ddos', label: 'DDoS Protection' },
          { value: 'brute-force', label: 'Brute Force' },
          { value: 'custom', label: 'Custom Rule' }
        ]
      },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        required: true,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' }
        ]
      },
      {
        name: 'action',
        label: 'Action',
        type: 'select',
        required: true,
        options: [
          { value: 'block', label: 'Block Request' },
          { value: 'log', label: 'Log Only' },
          { value: 'challenge', label: 'Challenge User' }
        ]
      },
      {
        name: 'ruleContent',
        label: 'Rule Content',
        type: 'textarea',
        placeholder: 'Enter ModSecurity rule syntax',
        required: true,
        description: 'Use ModSecurity rule syntax. Example: SecRule ARGS "@detectSQLi" "id:1001,phase:2,block"'
      }
    ],
    onSubmit: async (data) => {
      if (selectedRule) {
        // Update existing rule
        setRules(prev => prev.map(r => 
          r.id === selectedRule.id 
            ? { ...r, ...data, updatedAt: new Date() }
            : r
        ));
        showToast.success('Rule updated successfully');
        setShowEditModal(false);
      } else {
        // Create new rule
        const newRule: WAFRule = {
          id: `rule-${Date.now()}`,
          ...data,
          status: 'inactive',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
          matchCount: 0,
          falsePositives: 0
        };
        setRules(prev => [newRule, ...prev]);
        showToast.success('Rule created successfully');
        setShowCreateModal(false);
      }
      setSelectedRule(null);
    },
    schema: z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().min(1, 'Description is required'),
      category: z.string().min(1, 'Category is required'),
      severity: z.string().min(1, 'Severity is required'),
      action: z.string().min(1, 'Action is required'),
      ruleContent: z.string().min(1, 'Rule content is required')
    })
  };

  const columns: ColumnDef<WAFRule>[] = [
    {
      accessorKey: 'name',
      header: 'Rule Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.name}</div>
          <div className="text-sm text-slate-400">{row.original.description}</div>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getCategoryColor(row.original.category)}`}>
          {row.original.category.replace('-', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityColor(row.original.severity)}`}>
          {row.original.severity.toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(row.original.status)}`}>
          {row.original.status.toUpperCase()}
        </span>
      ),
    },
    {
      accessorKey: 'matchCount',
      header: 'Matches',
      cell: ({ row }) => (
        <div className="text-center">
          <div className="text-white font-medium">{row.original.matchCount}</div>
          <div className="text-xs text-slate-400">
            {row.original.falsePositives} FP
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'lastTriggered',
      header: 'Last Triggered',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.lastTriggered ? (
            <>
              <div className="text-white">{row.original.lastTriggered.toLocaleDateString()}</div>
              <div className="text-slate-400">{row.original.lastTriggered.toLocaleTimeString()}</div>
            </>
          ) : (
            <span className="text-slate-500">Never</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedRule(row.original);
            }}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedRule(row.original);
              setShowEditModal(true);
            }}
            className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
            title="Edit Rule"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleRule(row.original)}
            className="p-1 text-slate-400 hover:text-green-400 transition-colors"
            title={row.original.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {row.original.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleDuplicateRule(row.original)}
            className="p-1 text-slate-400 hover:text-yellow-400 transition-colors"
            title="Duplicate Rule"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteRule(row.original)}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-400" />
            WAF Rule Management
          </h1>
          <p className="text-slate-400 mt-1">Manage Web Application Firewall rules and policies</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="btn btn-ghost"
          >
            <Code className="w-4 h-4 mr-2" />
            Templates
          </button>
          <button
            onClick={() => showToast.info('Import functionality coming soon')}
            className="btn btn-ghost"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </button>
          <button
            onClick={() => showToast.info('Export functionality coming soon')}
            className="btn btn-ghost"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Rule
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Rules</p>
                <p className="text-2xl font-bold text-white">{rules.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Rules</p>
                <p className="text-2xl font-bold text-green-400">
                  {rules.filter(r => r.status === 'active').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Matches</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {rules.reduce((sum, rule) => sum + rule.matchCount, 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">False Positives</p>
                <p className="text-2xl font-bold text-red-400">
                  {rules.reduce((sum, rule) => sum + rule.falsePositives, 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search rules, descriptions, content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="sql-injection">SQL Injection</option>
              <option value="xss">Cross-Site Scripting</option>
              <option value="ddos">DDoS Protection</option>
              <option value="brute-force">Brute Force</option>
              <option value="custom">Custom Rules</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="testing">Testing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="card">
        <div className="card-body p-0">
          <DataTable
            data={filteredRules}
            columns={columns}
            title="WAF Rules"
            subtitle={`${filteredRules.length} rules found`}
            searchPlaceholder="Search rules..."
            pageSize={15}
            isLoading={isLoading}
            onRefresh={() => window.location.reload()}
          />
        </div>
      </div>

      {/* Create Rule Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New WAF Rule"
        size="lg"
      >
        <FormSystem
          config={ruleFormConfig}
          initialValues={{}}
        />
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRule(null);
        }}
        title="Edit WAF Rule"
        size="lg"
      >
        {selectedRule && (
          <FormSystem
            config={ruleFormConfig}
            initialValues={{
              name: selectedRule.name,
              description: selectedRule.description,
              category: selectedRule.category,
              severity: selectedRule.severity,
              action: selectedRule.action,
              ruleContent: selectedRule.ruleContent
            }}
          />
        )}
      </Modal>

      {/* Rule Detail Modal */}
      <Modal
        isOpen={!!selectedRule && !showEditModal}
        onClose={() => setSelectedRule(null)}
        title="Rule Details"
        size="lg"
      >
        {selectedRule && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Rule Name</label>
                <p className="text-white font-medium">{selectedRule.name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Category</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getCategoryColor(selectedRule.category)}`}>
                  {selectedRule.category.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Severity</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityColor(selectedRule.severity)}`}>
                  {selectedRule.severity.toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(selectedRule.status)}`}>
                  {selectedRule.status.toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Action</label>
                <p className="text-white">{selectedRule.action.toUpperCase()}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Created By</label>
                <p className="text-white">{selectedRule.createdBy}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Description</label>
              <p className="text-white mt-1">{selectedRule.description}</p>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Rule Content</label>
              <pre className="mt-1 p-4 bg-slate-800 rounded-lg text-sm text-cyan-400 overflow-x-auto">
                {selectedRule.ruleContent}
              </pre>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">Matches</p>
                <p className="text-2xl font-bold text-white">{selectedRule.matchCount}</p>
              </div>
              <div className="text-center p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">False Positives</p>
                <p className="text-2xl font-bold text-red-400">{selectedRule.falsePositives}</p>
              </div>
              <div className="text-center p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">Accuracy</p>
                <p className="text-2xl font-bold text-green-400">
                  {selectedRule.matchCount > 0 
                    ? ((selectedRule.matchCount - selectedRule.falsePositives) / selectedRule.matchCount * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Templates Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Rule Templates"
        size="lg"
      >
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">{template.name}</h3>
                <button
                  onClick={() => {
                    // Pre-fill create form with template
                    setShowTemplateModal(false);
                    setShowCreateModal(true);
                  }}
                  className="btn btn-sm btn-primary"
                >
                  Use Template
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-3">{template.description}</p>
              <pre className="text-xs text-cyan-400 bg-slate-900 p-3 rounded overflow-x-auto">
                {template.content}
              </pre>
              {template.variables.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500">Variables: {template.variables.join(', ')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteRule}
        title="Delete WAF Rule"
        message={`Are you sure you want to delete the rule "${ruleToDelete?.name}"? This action cannot be undone and may affect your security posture.`}
        confirmLabel="Delete Rule"
        type="error"
      />
    </div>
  );
};

export default RuleManagement;