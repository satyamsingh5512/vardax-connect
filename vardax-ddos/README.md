# VardaX DDoS Protection

Production-grade, self-hostable DDoS protection for VardaX WAF.

## Features

- **L3/L4 Protection**: XDP/eBPF packet filtering at 1M+ pps
- **L7 Protection**: ML-based bot detection, WAF rules, rate limiting
- **Challenge System**: JS proof-of-work, browser integrity checks
- **Edge Proxy**: TLS termination, JA3 fingerprinting, caching
- **Observability**: Prometheus metrics, Grafana dashboards, alerting

## Quick Start

```bash
# Deploy to Kubernetes
kubectl apply -f infrastructure/k8s/

# Or run locally with Docker Compose
docker-compose up -d
```

## Architecture

```
Internet → XDP Filter → Edge Proxy → Bot Detector → WAF → Origin
                              ↓
                        Challenge Service
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design.

## Components

| Component | Description | Port |
|-----------|-------------|------|
| edge-proxy | Envoy/Nginx reverse proxy | 443 |
| bot-detector | ML inference service | 8083 |
| waf | WAF rule engine | 8084 |
| challenge | JS challenge service | 8082 |
| xdp-manager | L3/L4 packet filter | 9100 |

## Configuration

### Environment Variables

```bash
# Bot Detector
MODEL_PATH=/models/bot_detector_lgb_latest.txt
REDIS_URL=redis://localhost:6379
BATCH_SIZE=100

# Challenge Service
CHALLENGE_SECRET=your-secret-key
MAX_FAILURES=3

# Rate Limiter
RATE_LIMIT_DEFAULT=100
RATE_LIMIT_WINDOW=1
```

### Rate Limiting

Edit `edge-proxy/lua/vardax/rate_limiter.lua`:

```lua
config.path_limits = {
    ["/api/login"] = {limit = 10, window = 60},
    ["/api/register"] = {limit = 5, window = 60},
}
```

### WAF Rules

Add custom rules to `waf/rules.yaml`:

```yaml
rules:
  - id: "custom-001"
    name: "Block bad bot"
    pattern: "BadBot|EvilCrawler"
    action: block
```

## ML Model Training

```bash
# Generate synthetic data and train
cd bot-detector
python train_model.py --synthetic --samples 100000

# Train with real data
python train_model.py --data /path/to/labeled_traffic.csv
```

## Testing

### Attack Simulation

```bash
# HTTP flood
python tests/attack_simulator.py -t localhost -p 443 -a http -r 1000 -d 60

# Slowloris
python tests/attack_simulator.py -t localhost -p 443 -a slowloris -T 100

# Mixed traffic (30% attack)
python tests/attack_simulator.py -t localhost -p 443 -a mixed -r 500
```

### Performance Testing

```bash
# Using wrk
wrk -t12 -c400 -d30s https://localhost/

# Using wrk2 (constant rate)
wrk2 -t12 -c400 -d30s -R10000 https://localhost/
```

## Monitoring

### Prometheus Metrics

| Metric | Description |
|--------|-------------|
| `vardax_xdp_packets_total` | Total packets by action |
| `vardax_bot_inference_requests_total` | Bot detection requests |
| `vardax_bot_inference_latency_seconds` | Inference latency |
| `vardax_challenges_issued_total` | Challenges issued |
| `vardax_challenges_passed_total` | Challenges passed |

### Grafana Dashboard

Import `monitoring/grafana-dashboard.json` into Grafana.

## Incident Response

See [RUNBOOK.md](RUNBOOK.md) for:
- Detection procedures
- Mitigation steps
- Emergency procedures
- Rollback instructions

## Performance Targets

| Metric | Target |
|--------|--------|
| L3/L4 Drop Rate | 1M+ pps |
| HTTP Throughput | 50k req/s |
| Inference Latency P99 | <2ms |
| Bot Detection ROC AUC | >0.95 |
| False Positive Rate | <0.5% |

## Directory Structure

```
vardax-ddos/
├── ARCHITECTURE.md          # System design
├── IMPLEMENTATION_PLAN.md   # 6-week sprint plan
├── RUNBOOK.md              # Incident response
├── README.md               # This file
├── bot-detector/           # ML bot detection
│   ├── feature_extractor.py
│   ├── train_model.py
│   ├── inference_server.py
│   └── requirements.txt
├── challenge/              # JS challenge service
│   └── challenge_service.py
├── edge-proxy/             # Envoy/Nginx configs
│   ├── envoy.yaml
│   ├── nginx.conf
│   └── lua/vardax/
├── infrastructure/         # Deployment configs
│   ├── docker/
│   └── k8s/
├── l4-filter/             # XDP/eBPF filter
│   ├── xdp_filter.c
│   └── xdp_loader.py
├── monitoring/            # Observability
│   ├── prometheus-rules.yaml
│   └── grafana-dashboard.json
├── tests/                 # Attack simulators
│   └── attack_simulator.py
└── waf/                   # WAF rule engine
    └── rule_engine.py
```

## Requirements

- Kubernetes 1.25+ or Docker 20+
- Linux kernel 4.8+ (for XDP)
- Python 3.11+
- Redis 7+
- 10 Gbps network (recommended)

## License

MIT License - See LICENSE file.

## Contributing

1. Fork the repository
2. Create feature branch
3. Run tests
4. Submit pull request

## Support

- GitHub Issues for bugs
- Discussions for questions
- Security issues: security@vardax.io
