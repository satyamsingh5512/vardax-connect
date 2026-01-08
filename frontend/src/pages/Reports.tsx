import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Search,
  Eye,
  Share,
  Clock,
  CheckCircle,
  BarChart3,
  Shield
} from 'lucide-react';
import { DataTable } from '../components/advanced/DataTable';
import { Modal } from '../components/advanced/ModalSystem';
import { FormSystem, type FormConfig } from '../components/advanced/FormSystem';
import { showToast } from '../components/advanced/NotificationSystem';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';

interface SecurityReport {
  id: string;
  name: string;
  type: 'security-summary' | 'threat-analysis' | 'compliance' | 'performance' | 'custom';
  description: string;
  status: 'completed' | 'generating' | 'scheduled' | 'failed';
  createdAt: Date;
  generatedBy: string;
  fileSize: string;
  format: 'pdf' | 'csv' | 'json' | 'xlsx';
  schedule?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  lastGenerated?: Date;
  nextScheduled?: Date;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  sections: string[];
  estimatedTime: string;
}

interface ComplianceMetric {
  framework: string;
  score: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  lastAssessed: Date;
  requirements: {
    total: number;
    passed: number;
    failed: number;
  };
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<SecurityReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetric[]>([]);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Generate mock reports
  const generateMockReports = (): SecurityReport[] => {
    const types: SecurityReport['type'][] = ['security-summary', 'threat-analysis', 'compliance', 'performance', 'custom'];
    const statuses: SecurityReport['status'][] = ['completed', 'generating', 'scheduled', 'failed'];
    const formats: SecurityReport['format'][] = ['pdf', 'csv', 'json', 'xlsx'];
    const schedules: SecurityReport['schedule'][] = ['daily', 'weekly', 'monthly', 'quarterly'];
    
    const reportNames = [
      'Monthly Security Summary',
      'Threat Intelligence Report',
      'GDPR Compliance Assessment',
      'Performance Analytics',
      'Incident Response Summary',
      'Vulnerability Assessment',
      'Access Control Audit',
      'Network Security Analysis',
      'Application Security Review',
      'Risk Assessment Report'
    ];

    return Array.from({ length: 20 }, (_, i) => ({
      id: `report-${i + 1}`,
      name: reportNames[i % reportNames.length] + ` ${Math.floor(i / reportNames.length) + 1}`,
      type: types[i % types.length],
      description: `Comprehensive ${types[i % types.length].replace('-', ' ')} report with detailed analysis and recommendations`,
      status: statuses[i % statuses.length],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      generatedBy: ['admin', 'security-team', 'compliance-officer'][i % 3],
      fileSize: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
      format: formats[i % formats.length],
      schedule: Math.random() > 0.5 ? schedules[i % schedules.length] : undefined,
      lastGenerated: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined,
      nextScheduled: Math.random() > 0.5 ? new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined
    }));
  };

  const generateMockTemplates = (): ReportTemplate[] => {
    return [
      {
        id: 'template-1',
        name: 'Executive Security Summary',
        description: 'High-level security overview for executives',
        type: 'security-summary',
        sections: ['Executive Summary', 'Key Metrics', 'Risk Assessment', 'Recommendations'],
        estimatedTime: '5-10 minutes'
      },
      {
        id: 'template-2',
        name: 'Detailed Threat Analysis',
        description: 'Comprehensive threat intelligence and analysis',
        type: 'threat-analysis',
        sections: ['Threat Landscape', 'Attack Patterns', 'IOCs', 'Mitigation Strategies'],
        estimatedTime: '15-20 minutes'
      },
      {
        id: 'template-3',
        name: 'Compliance Assessment',
        description: 'Regulatory compliance status and gaps',
        type: 'compliance',
        sections: ['Compliance Status', 'Gap Analysis', 'Remediation Plan', 'Timeline'],
        estimatedTime: '10-15 minutes'
      }
    ];
  };

  const generateComplianceMetrics = (): ComplianceMetric[] => {
    return [
      {
        framework: 'GDPR',
        score: 87,
        status: 'partial',
        lastAssessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        requirements: { total: 99, passed: 86, failed: 13 }
      },
      {
        framework: 'SOC 2',
        score: 94,
        status: 'compliant',
        lastAssessed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        requirements: { total: 64, passed: 60, failed: 4 }
      },
      {
        framework: 'ISO 27001',
        score: 78,
        status: 'partial',
        lastAssessed: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        requirements: { total: 114, passed: 89, failed: 25 }
      },
      {
        framework: 'PCI DSS',
        score: 96,
        status: 'compliant',
        lastAssessed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        requirements: { total: 12, passed: 12, failed: 0 }
      }
    ];
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockReports = generateMockReports();
      setReports(mockReports);
      setFilteredReports(mockReports);
      setTemplates(generateMockTemplates());
      setComplianceMetrics(generateComplianceMetrics());
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Filter reports
  useEffect(() => {
    let filtered = reports;

    if (searchQuery) {
      filtered = filtered.filter(report =>
        report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.generatedBy.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(report => report.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    setFilteredReports(filtered);
  }, [reports, searchQuery, typeFilter, statusFilter]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'security-summary': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'threat-analysis': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'compliance': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'performance': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'custom': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'generating': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'scheduled': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'partial': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'non-compliant': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const handleDownloadReport = (report: SecurityReport) => {
    showToast.success(`Downloading ${report.name}...`);
    // Simulate download
  };

  const handleGenerateReport = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newReport: SecurityReport = {
      id: `report-${Date.now()}`,
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      type: template.type as SecurityReport['type'],
      description: template.description,
      status: 'generating',
      createdAt: new Date(),
      generatedBy: 'admin',
      fileSize: '0 MB',
      format: 'pdf'
    };

    setReports(prev => [newReport, ...prev]);
    showToast.success('Report generation started');

    // Simulate report generation
    setTimeout(() => {
      setReports(prev => prev.map(r => 
        r.id === newReport.id 
          ? { ...r, status: 'completed', fileSize: `${(Math.random() * 5 + 1).toFixed(1)} MB` }
          : r
      ));
      showToast.success('Report generated successfully');
    }, 3000);
  };

  // Form configuration for creating custom reports
  const reportFormConfig: FormConfig = {
    title: 'Create Custom Report',
    description: 'Generate a custom security report with specific parameters',
    fields: [
      {
        name: 'name',
        label: 'Report Name',
        type: 'text',
        placeholder: 'Enter report name',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe the report purpose and scope',
        required: true
      },
      {
        name: 'type',
        label: 'Report Type',
        type: 'select',
        required: true,
        options: [
          { value: 'security-summary', label: 'Security Summary' },
          { value: 'threat-analysis', label: 'Threat Analysis' },
          { value: 'compliance', label: 'Compliance Assessment' },
          { value: 'performance', label: 'Performance Report' },
          { value: 'custom', label: 'Custom Report' }
        ]
      },
      {
        name: 'format',
        label: 'Output Format',
        type: 'select',
        required: true,
        options: [
          { value: 'pdf', label: 'PDF Document' },
          { value: 'xlsx', label: 'Excel Spreadsheet' },
          { value: 'csv', label: 'CSV File' },
          { value: 'json', label: 'JSON Data' }
        ]
      },
      {
        name: 'dateRange',
        label: 'Date Range',
        type: 'select',
        required: true,
        options: [
          { value: '7d', label: 'Last 7 Days' },
          { value: '30d', label: 'Last 30 Days' },
          { value: '90d', label: 'Last 90 Days' },
          { value: '1y', label: 'Last Year' },
          { value: 'custom', label: 'Custom Range' }
        ]
      },
      {
        name: 'schedule',
        label: 'Schedule (Optional)',
        type: 'select',
        options: [
          { value: '', label: 'One-time Report' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' }
        ]
      }
    ],
    onSubmit: async (data) => {
      const newReport: SecurityReport = {
        id: `report-${Date.now()}`,
        name: data.name,
        type: data.type,
        description: data.description,
        status: 'generating',
        createdAt: new Date(),
        generatedBy: 'admin',
        fileSize: '0 MB',
        format: data.format,
        schedule: data.schedule || undefined
      };

      setReports(prev => [newReport, ...prev]);
      showToast.success('Custom report generation started');
      setShowCreateModal(false);

      // Simulate report generation
      setTimeout(() => {
        setReports(prev => prev.map(r => 
          r.id === newReport.id 
            ? { ...r, status: 'completed', fileSize: `${(Math.random() * 8 + 2).toFixed(1)} MB` }
            : r
        ));
        showToast.success('Custom report generated successfully');
      }, 5000);
    },
    schema: z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().min(1, 'Description is required'),
      type: z.string().min(1, 'Type is required'),
      format: z.string().min(1, 'Format is required'),
      dateRange: z.string().min(1, 'Date range is required'),
      schedule: z.string().optional()
    })
  };

  const columns: ColumnDef<SecurityReport>[] = [
    {
      accessorKey: 'name',
      header: 'Report Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-white">{row.original.name}</div>
          <div className="text-sm text-slate-400">{row.original.description}</div>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getTypeColor(row.original.type)}`}>
          {row.original.type.replace('-', ' ').toUpperCase()}
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
      accessorKey: 'format',
      header: 'Format',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-cyan-400">{row.original.format.toUpperCase()}</span>
      ),
    },
    {
      accessorKey: 'fileSize',
      header: 'Size',
      cell: ({ row }) => (
        <span className="text-sm text-slate-300">{row.original.fileSize}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="text-white">{row.original.createdAt.toLocaleDateString()}</div>
          <div className="text-slate-400">{row.original.generatedBy}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedReport(row.original)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.original.status === 'completed' && (
            <button
              onClick={() => handleDownloadReport(row.original)}
              className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
              title="Download Report"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => showToast.info('Share functionality coming soon')}
            className="p-1 text-slate-400 hover:text-green-400 transition-colors"
            title="Share Report"
          >
            <Share className="w-4 h-4" />
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
            <FileText className="w-8 h-8 text-indigo-400" />
            Security Reports & Compliance
          </h1>
          <p className="text-slate-400 mt-1">Generate and manage security reports and compliance assessments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="btn btn-ghost"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Templates
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <FileText className="w-4 h-4 mr-2" />
            Create Report
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
                <p className="text-sm text-slate-400">Total Reports</p>
                <p className="text-2xl font-bold text-white">{reports.length}</p>
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
                <p className="text-sm text-slate-400">Completed</p>
                <p className="text-2xl font-bold text-green-400">
                  {reports.filter(r => r.status === 'completed').length}
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
                <p className="text-sm text-slate-400">Scheduled</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {reports.filter(r => r.schedule).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
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
                <p className="text-sm text-slate-400">Avg Compliance</p>
                <p className="text-2xl font-bold text-indigo-400">
                  {Math.round(complianceMetrics.reduce((sum, m) => sum + m.score, 0) / complianceMetrics.length)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Compliance Overview */}
      <div className="card">
        <div className="card-body p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {complianceMetrics.map((metric) => (
              <div key={metric.framework} className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{metric.framework}</h4>
                  <span className={`px-2 py-1 text-xs font-semibold rounded border ${getComplianceStatusColor(metric.status)}`}>
                    {metric.status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-400">Score</span>
                    <span className="text-white font-medium">{metric.score}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        metric.score >= 90 ? 'bg-green-500' : 
                        metric.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${metric.score}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Passed: {metric.requirements.passed}</span>
                    <span>Failed: {metric.requirements.failed}</span>
                  </div>
                  <div className="mt-1">
                    Last assessed: {metric.lastAssessed.toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="security-summary">Security Summary</option>
              <option value="threat-analysis">Threat Analysis</option>
              <option value="compliance">Compliance</option>
              <option value="performance">Performance</option>
              <option value="custom">Custom</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="generating">Generating</option>
              <option value="scheduled">Scheduled</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card">
        <div className="card-body p-0">
          <DataTable
            data={filteredReports}
            columns={columns}
            title="Security Reports"
            subtitle={`${filteredReports.length} reports found`}
            searchPlaceholder="Search reports..."
            pageSize={15}
            isLoading={isLoading}
            onRefresh={() => window.location.reload()}
          />
        </div>
      </div>

      {/* Create Report Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Custom Report"
        size="lg"
      >
        <FormSystem
          config={reportFormConfig}
          initialValues={{}}
        />
      </Modal>

      {/* Templates Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Report Templates"
        size="lg"
      >
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">{template.name}</h3>
                <button
                  onClick={() => {
                    handleGenerateReport(template.id);
                    setShowTemplateModal(false);
                  }}
                  className="btn btn-sm btn-primary"
                >
                  Generate Report
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-3">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Sections: {template.sections.join(', ')}</span>
                <span>Est. time: {template.estimatedTime}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Report Details"
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Report Name</label>
                <p className="text-white font-medium">{selectedReport.name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Type</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getTypeColor(selectedReport.type)}`}>
                  {selectedReport.type.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(selectedReport.status)}`}>
                  {selectedReport.status.toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Format</label>
                <p className="text-white font-mono">{selectedReport.format.toUpperCase()}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">File Size</label>
                <p className="text-white">{selectedReport.fileSize}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Generated By</label>
                <p className="text-white">{selectedReport.generatedBy}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Description</label>
              <p className="text-white mt-1">{selectedReport.description}</p>
            </div>
            
            {selectedReport.schedule && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Schedule</label>
                  <p className="text-white capitalize">{selectedReport.schedule}</p>
                </div>
                {selectedReport.nextScheduled && (
                  <div>
                    <label className="text-sm text-slate-400">Next Scheduled</label>
                    <p className="text-white">{selectedReport.nextScheduled.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
            
            {selectedReport.status === 'completed' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleDownloadReport(selectedReport)}
                  className="btn btn-primary flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </button>
                <button
                  onClick={() => showToast.info('Share functionality coming soon')}
                  className="btn btn-ghost flex-1"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share Report
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reports;