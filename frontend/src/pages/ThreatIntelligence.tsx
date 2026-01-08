import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Search,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle,
  MapPin,
  Zap
} from 'lucide-react';
import { DataTable } from '../components/advanced/DataTable';
import { Modal, ConfirmationModal } from '../components/advanced/ModalSystem';
import { showToast } from '../components/advanced/NotificationSystem';
import type { ColumnDef } from '@tanstack/react-table';

interface ThreatData {
  id: string;
  timestamp: Date;
  sourceIp: string;
  targetIp: string;
  country: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'blocked' | 'investigating' | 'resolved';
  confidence: number;
  description: string;
  attackVector: string;
  affectedAssets: string[];
}

interface ThreatStats {
  totalThreats: number;
  activeThreats: number;
  blockedThreats: number;
  criticalThreats: number;
  topCountries: { country: string; count: number }[];
  topThreatTypes: { type: string; count: number }[];
}

const ThreatIntelligence: React.FC = () => {
  const [threats, setThreats] = useState<ThreatData[]>([]);
  const [filteredThreats, setFilteredThreats] = useState<ThreatData[]>([]);
  const [stats, setStats] = useState<ThreatStats>({
    totalThreats: 0,
    activeThreats: 0,
    blockedThreats: 0,
    criticalThreats: 0,
    topCountries: [],
    topThreatTypes: []
  });
  const [selectedThreat, setSelectedThreat] = useState<ThreatData | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [threatToBlock, setThreatToBlock] = useState<ThreatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Generate mock threat data
  const generateMockThreats = (): ThreatData[] => {
    const threatTypes = ['SQL Injection', 'XSS Attack', 'DDoS', 'Brute Force', 'Malware', 'Phishing', 'Data Exfiltration'];
    const countries = ['Russia', 'China', 'North Korea', 'Iran', 'Brazil', 'India', 'USA', 'Germany'];
    const attackVectors = ['Web Application', 'Network', 'Email', 'USB', 'Social Engineering', 'API'];
    const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
    const statuses: ('active' | 'blocked' | 'investigating' | 'resolved')[] = ['active', 'blocked', 'investigating', 'resolved'];

    return Array.from({ length: 150 }, (_, i) => ({
      id: `threat-${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      sourceIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      targetIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
      country: countries[Math.floor(Math.random() * countries.length)],
      threatType: threatTypes[Math.floor(Math.random() * threatTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      confidence: Math.random() * 100,
      description: `Detected ${threatTypes[Math.floor(Math.random() * threatTypes.length)]} attempt from suspicious source`,
      attackVector: attackVectors[Math.floor(Math.random() * attackVectors.length)],
      affectedAssets: [`Asset-${Math.floor(Math.random() * 10) + 1}`]
    }));
  };

  // Calculate threat statistics
  const calculateStats = (threatData: ThreatData[]): ThreatStats => {
    const totalThreats = threatData.length;
    const activeThreats = threatData.filter(t => t.status === 'active').length;
    const blockedThreats = threatData.filter(t => t.status === 'blocked').length;
    const criticalThreats = threatData.filter(t => t.severity === 'critical').length;

    const countryCount = threatData.reduce((acc, threat) => {
      acc[threat.country] = (acc[threat.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCount = threatData.reduce((acc, threat) => {
      acc[threat.threatType] = (acc[threat.threatType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCountries = Object.entries(countryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    const topThreatTypes = Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return {
      totalThreats,
      activeThreats,
      blockedThreats,
      criticalThreats,
      topCountries,
      topThreatTypes
    };
  };

  // Initialize data
  useEffect(() => {
    const loadThreats = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockThreats = generateMockThreats();
      setThreats(mockThreats);
      setFilteredThreats(mockThreats);
      setStats(calculateStats(mockThreats));
      setIsLoading(false);
    };

    loadThreats();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Simulate new threats
      const newThreat = generateMockThreats().slice(0, 1)[0];
      newThreat.id = `threat-${Date.now()}`;
      newThreat.timestamp = new Date();
      
      setThreats(prev => {
        const updated = [newThreat, ...prev].slice(0, 150);
        setStats(calculateStats(updated));
        return updated;
      });
      
      showToast.security(`New ${newThreat.severity} threat detected from ${newThreat.country}`);
    }, 10000); // New threat every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Filter threats
  useEffect(() => {
    let filtered = threats;

    if (searchQuery) {
      filtered = filtered.filter(threat =>
        threat.sourceIp.includes(searchQuery) ||
        threat.threatType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        threat.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        threat.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter(threat => threat.severity === severityFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(threat => threat.status === statusFilter);
    }

    setFilteredThreats(filtered);
  }, [threats, searchQuery, severityFilter, statusFilter]);

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
      case 'active': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'blocked': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'investigating': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'resolved': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const handleBlockThreat = async (threat: ThreatData) => {
    setThreatToBlock(threat);
    setShowBlockModal(true);
  };

  const confirmBlockThreat = async () => {
    if (!threatToBlock) return;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    setThreats(prev => prev.map(t => 
      t.id === threatToBlock.id ? { ...t, status: 'blocked' as const } : t
    ));

    showToast.success(`Threat from ${threatToBlock.sourceIp} has been blocked`);
    setShowBlockModal(false);
    setThreatToBlock(null);
  };

  const columns: ColumnDef<ThreatData>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Time',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="text-white">{row.original.timestamp.toLocaleTimeString()}</div>
          <div className="text-slate-400">{row.original.timestamp.toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      accessorKey: 'sourceIp',
      header: 'Source IP',
      cell: ({ row }) => (
        <div className="font-mono text-sm text-cyan-400">{row.original.sourceIp}</div>
      ),
    },
    {
      accessorKey: 'country',
      header: 'Country',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 text-slate-400" />
          <span className="text-sm">{row.original.country}</span>
        </div>
      ),
    },
    {
      accessorKey: 'threatType',
      header: 'Threat Type',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.threatType}</span>
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
      accessorKey: 'confidence',
      header: 'Confidence',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="text-white">{row.original.confidence.toFixed(1)}%</div>
          <div className="w-16 bg-slate-700 rounded-full h-1 mt-1">
            <div 
              className="bg-blue-500 h-1 rounded-full" 
              style={{ width: `${row.original.confidence}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedThreat(row.original)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.original.status === 'active' && (
            <button
              onClick={() => handleBlockThreat(row.original)}
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Block Threat"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
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
            <Shield className="w-8 h-8 text-purple-400" />
            Threat Intelligence
            <span className="px-2 py-1 text-xs bg-green-500/10 text-green-400 rounded border border-green-500/20">
              LIVE
            </span>
          </h1>
          <p className="text-slate-400 mt-1">Real-time threat monitoring and analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Auto Refresh
          </button>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-ghost"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Threats</p>
                <p className="text-2xl font-bold text-white">{stats.totalThreats}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-400" />
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
                <p className="text-sm text-slate-400">Active Threats</p>
                <p className="text-2xl font-bold text-red-400">{stats.activeThreats}</p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
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
                <p className="text-sm text-slate-400">Blocked</p>
                <p className="text-2xl font-bold text-green-400">{stats.blockedThreats}</p>
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
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical</p>
                <p className="text-2xl font-bold text-orange-400">{stats.criticalThreats}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-orange-400" />
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
                  placeholder="Search threats, IPs, countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Threats Table */}
      <div className="card">
        <div className="card-body p-0">
          <DataTable
            data={filteredThreats}
            columns={columns}
            title="Live Threat Feed"
            subtitle={`${filteredThreats.length} threats found`}
            searchPlaceholder="Search threats..."
            enableVirtualization={true}
            pageSize={25}
            isLoading={isLoading}
            onRefresh={() => window.location.reload()}
            onExport={() => showToast.info('Export functionality coming soon')}
          />
        </div>
      </div>

      {/* Threat Detail Modal */}
      <Modal
        isOpen={!!selectedThreat}
        onClose={() => setSelectedThreat(null)}
        title="Threat Details"
        size="lg"
      >
        {selectedThreat && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Source IP</label>
                <p className="font-mono text-cyan-400">{selectedThreat.sourceIp}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Target IP</label>
                <p className="font-mono text-cyan-400">{selectedThreat.targetIp}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Country</label>
                <p className="text-white">{selectedThreat.country}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Threat Type</label>
                <p className="text-white">{selectedThreat.threatType}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Severity</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityColor(selectedThreat.severity)}`}>
                  {selectedThreat.severity.toUpperCase()}
                </span>
              </div>
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(selectedThreat.status)}`}>
                  {selectedThreat.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Description</label>
              <p className="text-white mt-1">{selectedThreat.description}</p>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Attack Vector</label>
              <p className="text-white mt-1">{selectedThreat.attackVector}</p>
            </div>
            
            <div>
              <label className="text-sm text-slate-400">Affected Assets</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedThreat.affectedAssets.map((asset, index) => (
                  <span key={index} className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-sm">
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Block Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={confirmBlockThreat}
        title="Block Threat"
        message={`Are you sure you want to block all traffic from ${threatToBlock?.sourceIp}? This action will immediately prevent any further requests from this IP address.`}
        confirmLabel="Block IP"
        type="warning"
      />
    </div>
  );
};

export default ThreatIntelligence;