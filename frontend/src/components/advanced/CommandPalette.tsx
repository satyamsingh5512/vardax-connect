import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Shield, 
  Activity, 
  Settings, 
  BarChart3, 
  FileText,
  Zap,
  Database,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { useStore } from '../../store';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { setCurrentPage, setActiveTab } = useStore();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Dashboard',
      subtitle: 'View system overview',
      icon: <Activity className="w-4 h-4" />,
      action: () => setCurrentPage('dashboard'),
      category: 'Navigation',
      keywords: ['dashboard', 'home', 'overview']
    },
    {
      id: 'nav-threats',
      title: 'Threat Intelligence',
      subtitle: 'Monitor security threats',
      icon: <Shield className="w-4 h-4" />,
      action: () => setCurrentPage('threats'),
      category: 'Navigation',
      keywords: ['threats', 'security', 'intelligence']
    },
    {
      id: 'nav-analytics',
      title: 'Analytics',
      subtitle: 'View detailed analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => setCurrentPage('analytics'),
      category: 'Navigation',
      keywords: ['analytics', 'charts', 'data']
    },
    {
      id: 'nav-rules',
      title: 'Rule Management',
      subtitle: 'Manage security rules',
      icon: <FileText className="w-4 h-4" />,
      action: () => setCurrentPage('rules'),
      category: 'Navigation',
      keywords: ['rules', 'management', 'policies']
    },
    {
      id: 'nav-settings',
      title: 'Settings',
      subtitle: 'Configure system settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => setCurrentPage('settings'),
      category: 'Navigation',
      keywords: ['settings', 'config', 'preferences']
    },
    // Quick Actions
    {
      id: 'action-generate-rules',
      title: 'Generate Security Rules',
      subtitle: 'Create new ML-based rules',
      icon: <Zap className="w-4 h-4" />,
      action: () => {
        setCurrentPage('rules');
        // Trigger rule generation
      },
      category: 'Quick Actions',
      keywords: ['generate', 'rules', 'ml', 'create']
    },
    {
      id: 'action-export-data',
      title: 'Export Analytics Data',
      subtitle: 'Download system reports',
      icon: <Database className="w-4 h-4" />,
      action: () => {
        // Trigger export
      },
      category: 'Quick Actions',
      keywords: ['export', 'download', 'data', 'reports']
    },
    {
      id: 'action-system-health',
      title: 'System Health Check',
      subtitle: 'Run diagnostics',
      icon: <AlertTriangle className="w-4 h-4" />,
      action: () => {
        setActiveTab('models');
      },
      category: 'Quick Actions',
      keywords: ['health', 'diagnostics', 'check', 'system']
    },
    // Tabs
    {
      id: 'tab-overview',
      title: 'Overview Tab',
      subtitle: 'Main dashboard view',
      icon: <Globe className="w-4 h-4" />,
      action: () => setActiveTab('overview'),
      category: 'Dashboard Tabs',
      keywords: ['overview', 'main', 'summary']
    },
    {
      id: 'tab-traffic',
      title: 'Traffic Analysis',
      subtitle: 'Network traffic insights',
      icon: <Activity className="w-4 h-4" />,
      action: () => setActiveTab('traffic'),
      category: 'Dashboard Tabs',
      keywords: ['traffic', 'network', 'analysis']
    },
    {
      id: 'tab-anomalies',
      title: 'Anomaly Detection',
      subtitle: 'Security anomalies',
      icon: <Shield className="w-4 h-4" />,
      action: () => setActiveTab('anomalies'),
      category: 'Dashboard Tabs',
      keywords: ['anomalies', 'detection', 'security']
    }
  ];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const filteredCommands = commands.filter(command =>
    command.title.toLowerCase().includes(search.toLowerCase()) ||
    command.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
    command.keywords.some(keyword => keyword.toLowerCase().includes(search.toLowerCase()))
  );

  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command className="rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center border-b border-slate-700 px-4">
                <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                <Command.Input
                  placeholder="Search commands..."
                  value={search}
                  onValueChange={setSearch}
                  className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
              <Command.List className="max-h-96 overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-slate-400">
                  No results found.
                </Command.Empty>
                {Object.entries(groupedCommands).map(([category, items]) => (
                  <Command.Group key={category} heading={category}>
                    {items.map((command) => (
                      <Command.Item
                        key={command.id}
                        value={command.title}
                        onSelect={() => {
                          command.action();
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[selected]:bg-slate-800 data-[selected]:text-white hover:bg-slate-800/50"
                      >
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-300">
                          {command.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-white">{command.title}</div>
                          {command.subtitle && (
                            <div className="text-xs text-slate-400">{command.subtitle}</div>
                          )}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}