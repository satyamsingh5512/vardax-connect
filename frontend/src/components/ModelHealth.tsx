import { useDashboardStore } from '../store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

// Mock inference latency data
const latencyData = Array.from({ length: 60 }, (_, i) => ({
  time: i,
  isolation_forest: 4 + Math.random() * 3,
  autoencoder: 10 + Math.random() * 5,
  ewma: 0.3 + Math.random() * 0.4,
}));

export function ModelHealth() {
  const { modelHealth } = useDashboardStore();
  
  // Use mock data if no real data
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-white">ML Model Health</h2>
        <p className="text-sm text-vardax-muted">
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
      <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
        <h3 className="text-sm font-medium text-vardax-muted mb-4">
          Inference Latency (Last 60 seconds)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={latencyData}>
            <XAxis dataKey="time" stroke="#718096" fontSize={10} />
            <YAxis stroke="#718096" fontSize={10} unit="ms" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #2d3748' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Line
              type="monotone"
              dataKey="isolation_forest"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Isolation Forest"
            />
            <Line
              type="monotone"
              dataKey="autoencoder"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="Autoencoder"
            />
            <Line
              type="monotone"
              dataKey="ewma"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="EWMA"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-4">
          <LegendItem color="#3b82f6" label="Isolation Forest" />
          <LegendItem color="#8b5cf6" label="Autoencoder" />
          <LegendItem color="#10b981" label="EWMA Baseline" />
        </div>
      </div>
      
      {/* Ensemble Info */}
      <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
        <h3 className="text-sm font-medium text-vardax-muted mb-4">Ensemble Configuration</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs text-vardax-muted mb-3">Model Weights</h4>
            <div className="space-y-2">
              <WeightBar label="Isolation Forest" weight={0.4} color="#3b82f6" />
              <WeightBar label="Autoencoder" weight={0.35} color="#8b5cf6" />
              <WeightBar label="EWMA Baseline" weight={0.25} color="#10b981" />
            </div>
          </div>
          <div>
            <h4 className="text-xs text-vardax-muted mb-3">Why This Ensemble?</h4>
            <ul className="text-sm text-vardax-text space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <span><strong>Isolation Forest</strong> catches point anomalies (single weird requests)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span><strong>Autoencoder</strong> catches pattern anomalies (unusual feature combinations)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                <span><strong>EWMA</strong> catches rate anomalies (traffic volume deviations)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Performance Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Combined Latency"
          value="18.2ms"
          subtitle="p99: 45ms"
          status="good"
        />
        <MetricCard
          title="Throughput"
          value="5,200/sec"
          subtitle="Target: 10,000/sec"
          status="good"
        />
        <MetricCard
          title="False Positive Rate"
          value="1.8%"
          subtitle="Target: <2%"
          status="good"
        />
        <MetricCard
          title="Detection Rate"
          value="98.5%"
          subtitle="On test set"
          status="good"
        />
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: any }) {
  const isHealthy = model.avg_inference_time_ms < 50 && model.false_positive_rate < 0.05;
  
  return (
    <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            isHealthy ? 'bg-severity-normal' : 'bg-severity-medium'
          )} />
          <h3 className="font-medium text-white">{model.model_name}</h3>
        </div>
        <span className="text-xs text-vardax-muted">v{model.version}</span>
      </div>
      
      <div className="space-y-3">
        <MetricRow
          label="Avg Inference Time"
          value={`${model.avg_inference_time_ms.toFixed(1)}ms`}
        />
        <MetricRow
          label="Inferences (24h)"
          value={model.inference_count_24h.toLocaleString()}
        />
        <MetricRow
          label="Anomaly Rate"
          value={`${(model.anomaly_rate_24h * 100).toFixed(1)}%`}
        />
        <MetricRow
          label="False Positive Rate"
          value={`${(model.false_positive_rate * 100).toFixed(1)}%`}
        />
        <MetricRow
          label="Training Samples"
          value={model.training_samples.toLocaleString()}
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-vardax-muted">{label}</span>
      <span className="text-vardax-text font-medium">{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      <span className="text-xs text-vardax-muted">{label}</span>
    </div>
  );
}

function WeightBar({ label, weight, color }: { label: string; weight: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-vardax-muted w-28">{label}</span>
      <div className="flex-1 h-2 bg-vardax-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${weight * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-vardax-text w-10 text-right">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string;
  value: string;
  subtitle: string;
  status: 'good' | 'warning' | 'bad';
}) {
  const statusColors = {
    good: 'text-severity-normal',
    warning: 'text-severity-medium',
    bad: 'text-severity-high',
  };
  
  return (
    <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
      <div className="text-sm text-vardax-muted mb-1">{title}</div>
      <div className={clsx('text-2xl font-bold', statusColors[status])}>{value}</div>
      <div className="text-xs text-vardax-muted mt-1">{subtitle}</div>
    </div>
  );
}
