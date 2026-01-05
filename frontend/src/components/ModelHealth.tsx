import { useDashboardStore } from '../store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Mock inference latency data
const latencyData = Array.from({ length: 60 }, (_, i) => ({
  time: i,
  isolation_forest: 4 + Math.random() * 3,
  autoencoder: 10 + Math.random() * 5,
  ewma: 0.3 + Math.random() * 0.4,
}));

export function ModelHealth() {
  const { modelHealth } = useDashboardStore();
  
  const models = modelHealth.length > 0 ? modelHealth : [
    {
      model_name: 'Isolation Forest',
      version: '1.0.0',
      last_trained: new Date(Date.now() - 86400000).toISOString(),
      training_samples: 50000,
      inference_count_24h: 125000,
      avg_inference_time_ms: 5.2,
      anomaly_rate_24h: 0.021,
      false_positive_rate: 0.012,
    },
    {
      model_name: 'Autoencoder',
      version: '1.0.0',
      last_trained: new Date(Date.now() - 86400000).toISOString(),
      training_samples: 50000,
      inference_count_24h: 125000,
      avg_inference_time_ms: 12.5,
      anomaly_rate_24h: 0.025,
      false_positive_rate: 0.018,
    },
    {
      model_name: 'EWMA Baseline',
      version: '1.0.0',
      last_trained: new Date().toISOString(),
      training_samples: 125000,
      inference_count_24h: 125000,
      avg_inference_time_ms: 0.5,
      anomaly_rate_24h: 0.018,
      false_positive_rate: 0.008,
    },
  ];
  
  return (
    <div className="p-6 space-y-6 overflow-auto h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>ML Model Health</h2>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Monitor model performance, latency, and accuracy metrics
        </p>
      </div>
      
      {/* Model Cards */}
      <div className="grid grid-cols-3 gap-6">
        {models.map((model) => (
          <ModelCard key={model.model_name} model={model} />
        ))}
      </div>
      
      {/* Latency Chart */}
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">Inference Latency (Last 60 seconds)</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={latencyData}>
            <XAxis dataKey="time" stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#6e7681" fontSize={10} unit="ms" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: '#161b22', 
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
              }}
              labelStyle={{ color: '#f0f6fc', fontWeight: 600 }}
            />
            <Line type="monotone" dataKey="isolation_forest" stroke="#3b82f6" strokeWidth={3} dot={false} name="Isolation Forest" />
            <Line type="monotone" dataKey="autoencoder" stroke="#a855f7" strokeWidth={3} dot={false} name="Autoencoder" />
            <Line type="monotone" dataKey="ewma" stroke="#10b981" strokeWidth={3} dot={false} name="EWMA" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-4">
          <LegendItem color="#3b82f6" label="Isolation Forest" />
          <LegendItem color="#a855f7" label="Autoencoder" />
          <LegendItem color="#10b981" label="EWMA Baseline" />
        </div>
      </div>
      
      {/* Ensemble Info */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Ensemble Configuration</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Model Weights</h4>
              <div className="space-y-3">
                <WeightBar label="Isolation Forest" weight={0.4} color="#388bfd" />
                <WeightBar label="Autoencoder" weight={0.35} color="#a371f7" />
                <WeightBar label="EWMA Baseline" weight={0.25} color="#3fb950" />
              </div>
            </div>
            <div>
              <h4 className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Why This Ensemble?</h4>
              <ul className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#388bfd' }}>•</span>
                  <span><strong>Isolation Forest</strong> catches point anomalies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#a371f7' }}>•</span>
                  <span><strong>Autoencoder</strong> catches pattern anomalies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span style={{ color: '#3fb950' }}>•</span>
                  <span><strong>EWMA</strong> catches rate anomalies</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Combined Latency" value="18.2ms" subtitle="p99: 45ms" status="good" />
        <MetricCard title="Throughput" value="5,200/sec" subtitle="Target: 10,000/sec" status="good" />
        <MetricCard title="False Positive Rate" value="1.8%" subtitle="Target: <2%" status="good" />
        <MetricCard title="Detection Rate" value="98.5%" subtitle="On test set" status="good" />
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: any }) {
  const isHealthy = model.avg_inference_time_ms < 50 && model.false_positive_rate < 0.05;
  
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isHealthy ? 'var(--accent-green)' : 'var(--accent-yellow)' }}
          />
          <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>{model.model_name}</h3>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>v{model.version}</span>
      </div>
      <div className="card-body space-y-3">
        <MetricRow label="Avg Inference Time" value={`${model.avg_inference_time_ms.toFixed(1)}ms`} />
        <MetricRow label="Inferences (24h)" value={model.inference_count_24h.toLocaleString()} />
        <MetricRow label="Anomaly Rate" value={`${(model.anomaly_rate_24h * 100).toFixed(1)}%`} />
        <MetricRow label="False Positive Rate" value={`${(model.false_positive_rate * 100).toFixed(1)}%`} />
        <MetricRow label="Training Samples" value={model.training_samples.toLocaleString()} />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}

function WeightBar({ label, weight, color }: { label: string; weight: number; color: string }) {
  return (
    <div className="score-bar">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${weight * 100}%`, backgroundColor: color }} />
      </div>
      <span className="score-value">{(weight * 100).toFixed(0)}%</span>
    </div>
  );
}

function MetricCard({ title, value, subtitle, status }: { title: string; value: string; subtitle: string; status: 'good' | 'warning' | 'bad' }) {
  const statusColors = {
    good: 'var(--accent-green)',
    warning: 'var(--accent-yellow)',
    bad: 'var(--accent-red)',
  };
  
  return (
    <div className={`stat-card ${status === 'good' ? 'success' : status === 'warning' ? 'warning' : 'critical'}`}>
      <div className="stat-label">{title}</div>
      <div className="stat-value" style={{ color: statusColors[status], fontSize: '24px' }}>{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}
