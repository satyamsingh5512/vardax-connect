# Sentinelas: ML-Augmented WAF with Explainable AI

<p align="center">
  <img src="docs/logo.svg" alt="Sentinelas Logo" width="200">
  <br>
  <strong>See Why. Block Smart.</strong>
</p>

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](docker-compose.yml)
[![Air-Gap](https://img.shields.io/badge/mode-air--gap-orange.svg)]()

**Sentinelas** is an offline-capable, indigenous ML-augmented Web Application Firewall that combines:
- 🛡️ **Coraza WAF** (Go) for request interception and feature extraction
- 🧠 **ML Models** (Autoencoder + XGBoost) for anomaly detection and attack classification
- 💡 **SHAP Explainability** for human-readable decision explanations
- 🔧 **Auto-Rule Generation** with ReDoS safety checks
- 📊 **Real-time Dashboard** for SOC operators

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourorg/sentinelas.git
cd sentinelas

# Copy environment configuration
cp .env.example .env

# Start all services
docker-compose up -d --build

# Wait for services to be healthy (~30 seconds)
sleep 30

# Check health
curl http://localhost:8000/health

# Open the dashboard
open http://localhost:3000
```

## Demo Attacks

Try these attacks and watch them get blocked with explanations:

```bash
# SQL Injection
curl "http://localhost:8080/search?id=1'+OR+'1'='1"

# XSS
curl "http://localhost:8080/comment?text=<script>alert(1)</script>"

# Path Traversal
curl "http://localhost:8080/file?path=../../../../etc/passwd"

# Command Injection
curl "http://localhost:8080/ping?host=127.0.0.1;cat+/etc/passwd"
```

## Architecture

```
Client → Caddy (TLS) → Coraza Plugin → gRPC → ML Service → Verdict
                                                    ↓
                                              SHAP + Rule
                                                    ↓
                              Redis ← TimescaleDB → Dashboard
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| WAF Endpoint | 8080 | Send HTTP requests here |
| ML API | 8000 | FastAPI REST + gRPC |
| gRPC | 50051 | Internal ML communication |
| Dashboard | 3000 | React-based SOC console |
| Redis | 6379 | Verdict caching |
| TimescaleDB | 5432 | Time-series analytics |

## Key Features

### Detection (>99% accuracy)
- **Autoencoder** trained on benign traffic for anomaly detection
- **XGBoost** classifier for multi-class attack categorization
- Support for SQLi, XSS, LFI, RCE, Path Traversal, and more

### Explainability (SHAP)
- Feature attribution for every blocked request
- Human-readable summaries
- Interactive force plot visualization

### Auto-Rule Generation
- Synthesizes Coraza SecRules from detected attacks
- ReDoS safety checking
- False positive rate estimation

### Indigenisation
- 100% open-source components
- Runs completely air-gapped
- No external API dependencies

## Model Training

```bash
cd ml-service

# Install dependencies
pip install -r requirements.txt

# Train on CIC-IDS2017 (or synthetic data)
python training/train_models.py \
    --data-path /path/to/cicids2017 \
    --output-path ./saved_models
```

## Evaluation

```bash
# Run full evaluation suite
./tests/evaluation/run_evaluation.sh

# Expected output:
# Detection Rate: 99.2%
# False Positive Rate: 0.3%
# Average Latency: 1.8ms
```

## Configuration

Key environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_TIMEOUT_MS` | 10 | ML inference timeout |
| `SHADOW_MODE` | false | Log-only mode |
| `BATCH_SIZE` | 32 | gRPC batch size |

## Project Structure

```
sentinelas/
├── caddy/                 # TLS termination
├── coraza-plugin/         # Go WAF plugin
├── ml-service/            # Python ML backend
│   ├── app/
│   │   ├── models/        # Autoencoder, XGBoost
│   │   ├── explainer/     # SHAP integration
│   │   └── rule_generator/# SecRule synthesis
│   └── training/          # Model training scripts
├── dashboard/             # React frontend
├── tests/                 # Evaluation scripts
└── scripts/               # Demo and utility scripts
```

## Documentation

- [Complete Deliverables](DELIVERABLES.md) - Full technical specification
- [Architecture Guide](docs/architecture.md) - Detailed system design
- [API Reference](docs/api.md) - REST and gRPC endpoints

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## Acknowledgments

- [OWASP Coraza](https://github.com/corazawaf/coraza) - WAF engine
- [SHAP](https://github.com/shap/shap) - Explainability
- [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html) - Training dataset
