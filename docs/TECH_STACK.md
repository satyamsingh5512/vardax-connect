# Technology Stack - VARDAx

## 🏗️ Complete Stack Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  React 18 + TypeScript + TailwindCSS + Recharts + WebSocket     │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                               │
│           FastAPI + Pydantic + WebSocket + JWT Auth             │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       ML INFERENCE LAYER                         │
│     scikit-learn (Isolation Forest) + PyTorch (Autoencoder)     │
│                    + NumPy (EWMA Baseline)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      STREAMING LAYER                             │
│                    Redis Streams + Pub/Sub                       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                              │
│         TimescaleDB (metrics) + PostgreSQL (config/rules)       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     TRAFFIC CAPTURE LAYER                        │
│              NGINX + ModSecurity + Lua (mirroring)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Detailed Stack Decisions

### 1. Traffic Capture & WAF

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Web Server** | NGINX | Industry standard, excellent performance, native ModSecurity support |
| **WAF Engine** | ModSecurity 3.x | Open-source, OWASP CRS compatible, mature ecosystem |
| **Traffic Mirror** | Lua + ngx.location.capture | Non-blocking async copy, minimal overhead |

**Rejected Alternatives:**
- Apache + mod_security: Higher memory footprint, slower
- HAProxy: Less WAF integration, would need separate WAF
- Envoy: More complex, overkill for this use case

---

### 2. ML & Anomaly Detection

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Outlier Detection** | Isolation Forest (sklearn) | Fast training, no labels needed, interpretable |
| **Pattern Anomaly** | Autoencoder (PyTorch) | Catches complex patterns, reconstruction error = anomaly |
| **Rate Baseline** | EWMA (NumPy) | Simple, adaptive, highly interpretable |
| **Feature Engineering** | Pandas + NumPy | Fast vectorized operations |

**Rejected Alternatives:**
- Deep learning (LSTM/Transformer): Too complex, slow inference, black box
- One-Class SVM: Slower than Isolation Forest, less scalable
- Statistical methods only: Miss complex attack patterns

**Why This Combination:**
```
Isolation Forest  → Catches point anomalies (single weird request)
Autoencoder       → Catches pattern anomalies (unusual sequences)
EWMA Baseline     → Catches rate anomalies (traffic spikes)

Combined = Comprehensive coverage with explainability
```

---

### 3. Backend APIs

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Framework** | FastAPI | Async-native, auto OpenAPI docs, type hints |
| **Validation** | Pydantic v2 | Fast validation, clear error messages |
| **Auth** | JWT + python-jose | Stateless, scalable |
| **WebSocket** | FastAPI WebSocket | Real-time dashboard updates |
| **Task Queue** | Redis + custom worker | Simple, no Celery overhead |

**Rejected Alternatives:**
- Flask: Not async-native, slower
- Django: Too heavy for API-only service
- gRPC: Overkill, harder to debug

---

### 4. Frontend Dashboard

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Framework** | React 18 | Component model, huge ecosystem |
| **Language** | TypeScript | Type safety, better DX |
| **Styling** | TailwindCSS | Rapid dark theme development |
| **Charts** | Recharts | React-native, good animations |
| **State** | Zustand | Simple, no Redux boilerplate |
| **Real-time** | Native WebSocket | Direct, no Socket.io overhead |

**Rejected Alternatives:**
- Vue/Svelte: Smaller ecosystem for security dashboards
- D3.js: Too low-level for rapid development
- Material UI: Harder to customize dark theme

---

### 5. Data Storage

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Time-series** | TimescaleDB | PostgreSQL-compatible, excellent for metrics |
| **Config/Rules** | PostgreSQL | ACID, reliable, familiar |
| **Cache** | Redis | Sub-ms latency, pub/sub built-in |
| **Model Storage** | File system + versioning | Simple, works with MLflow |

**Rejected Alternatives:**
- InfluxDB: Different query language, less SQL familiarity
- MongoDB: Not ideal for time-series, no native compression
- Cassandra: Overkill for this scale

---

### 6. Messaging / Streaming

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Traffic Queue** | Redis Streams | Persistent, consumer groups, fast |
| **Real-time Events** | Redis Pub/Sub | Low latency, simple |
| **Batch Processing** | Redis Streams + consumer groups | Built-in offset tracking |

**Rejected Alternatives:**
- Kafka: Operational overhead, overkill for single-node demo
- RabbitMQ: Less suited for streaming patterns
- AWS SQS: Cloud dependency, latency

---

### 7. Model Serving

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Inference** | In-process (sklearn/PyTorch) | Lowest latency, simple |
| **Model Format** | Joblib (sklearn) + ONNX (PyTorch) | Fast loading, portable |
| **Versioning** | MLflow | Industry standard, simple tracking |

**Rejected Alternatives:**
- TensorFlow Serving: Overkill, adds network hop
- Triton: Too complex for this use case
- BentoML: Additional abstraction layer

---

### 8. Deployment

| Choice | Technology | Justification |
|--------|------------|---------------|
| **Containerization** | Docker + Docker Compose | Simple local dev, portable |
| **Orchestration** | Docker Compose (demo) / K8s (prod) | Right-sized for hackathon |
| **Reverse Proxy** | NGINX (same as WAF) | Single entry point |
| **Monitoring** | Prometheus + Grafana | Industry standard |

---

## 📊 Performance Characteristics

| Component | Latency | Throughput | Memory |
|-----------|---------|------------|--------|
| NGINX + ModSecurity | < 2ms | 50k req/s | 100MB |
| Redis Streams | < 1ms | 100k msg/s | 1GB |
| Feature Extraction | < 10ms | 5k req/s | 500MB |
| Isolation Forest | < 5ms | 10k inf/s | 200MB |
| Autoencoder | < 20ms | 2k inf/s | 500MB |
| EWMA Baseline | < 1ms | 50k calc/s | 100MB |
| FastAPI | < 5ms | 10k req/s | 200MB |

**Total System**: < 50ms end-to-end anomaly detection (async)

---

## 🔒 Security Stack

| Concern | Solution |
|---------|----------|
| API Auth | JWT with RS256 |
| Data Encryption | TLS 1.3 in transit, AES-256 at rest |
| Secrets | Environment variables / Docker secrets |
| Input Validation | Pydantic strict mode |
| SQL Injection | SQLAlchemy ORM with parameterized queries |
| XSS | React auto-escaping + CSP headers |
| CSRF | SameSite cookies + CSRF tokens |
