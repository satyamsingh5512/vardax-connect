# VARDAx - ML-Powered WAF Anomaly Detection System

## 🎯 The Problem

Traditional WAFs fail because:
- **Signature-based**: Only catch known attacks (CVE-XXXX)
- **Zero-day blind**: New attack patterns slip through
- **High false positives**: Static rules trigger on legitimate traffic
- **No learning**: Same mistakes repeated forever

## 💡 Our Solution: Behavioral Anomaly Detection

VARDAx learns what "normal" looks like for YOUR traffic, then flags deviations with confidence scores and human-readable explanations.

**Key Differentiator**: We don't replace your WAF—we make it smarter.

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NGINX + TLS TERMINATION                              │
│                    (SSL/TLS decryption happens here)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      ModSecurity WAF         │    │    Traffic Mirror (async)     │
│   (Existing rule engine)     │    │    (Non-blocking copy)        │
│                              │    │                                │
│  • OWASP Core Rule Set       │    │  Sends to ML pipeline         │
│  • Custom rules              │    │  without blocking request      │
│  • VARDAx dynamic rules  │    │                                │
└──────────────────────────────┘    └──────────────────────────────┘
            │                                       │
            ▼                                       ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      Backend Services        │    │     Redis Stream Queue       │
│    (Your application)        │    │   (Async traffic buffer)     │
└──────────────────────────────┘    └──────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌──────────────────────────────┐
                                    │   FEATURE EXTRACTION ENGINE  │
                                    │                              │
                                    │  • Request features          │
                                    │  • Session features          │
                                    │  • Behavioral features       │
                                    │  • Rate/timing features      │
                                    └──────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌──────────────────────────────┐
                                    │      ML INFERENCE ENGINE     │
                                    │                              │
                                    │  Layer 1: Isolation Forest   │
                                    │  Layer 2: Autoencoder        │
                                    │  Layer 3: EWMA Baseline      │
                                    │                              │
                                    │  Output: Anomaly Score +     │
                                    │          Explanation         │
                                    └──────────────────────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                    ┌──────────────────────────────┐    ┌──────────────────────────────┐
                    │    RULE RECOMMENDATION       │    │      TimescaleDB             │
                    │         ENGINE               │    │   (Anomaly storage)          │
                    │                              │    │                              │
                    │  ML insight → WAF rule       │    │  • Time-series metrics       │
                    │  + Confidence score          │    │  • Anomaly history           │
                    │  + Human approval required   │    │  • Feedback data             │
                    └──────────────────────────────┘    └──────────────────────────────┘
                                    │                               │
                                    ▼                               ▼
                    ┌──────────────────────────────┐    ┌──────────────────────────────┐
                    │     ADMIN DASHBOARD          │◄───│      FastAPI Backend         │
                    │                              │    │                              │
                    │  • Live traffic view         │    │  • REST APIs                 │
                    │  • Anomaly timeline          │    │  • WebSocket (real-time)     │
                    │  • Rule approval UI          │    │  • Feedback ingestion        │
                    │  • Explainability panels     │    │                              │
                    └──────────────────────────────┘    └──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │   CONTINUOUS LEARNING LOOP   │
                    │                              │
                    │  Analyst feedback →          │
                    │  Model retraining →          │
                    │  Reduced false positives     │
                    └──────────────────────────────┘
```

---

## 📊 DATA FLOW (Step-by-Step)

### Normal Request Flow (< 5ms added latency)
1. **Request arrives** → NGINX terminates TLS
2. **Traffic mirrored** → Async copy to Redis (non-blocking)
3. **ModSecurity checks** → Existing rules execute normally
4. **Request proceeds** → Backend serves response
5. **ML analyzes async** → No impact on response time

### Anomaly Detection Flow
1. **Feature extraction** → 47 behavioral features computed
2. **ML scoring** → Isolation Forest + Autoencoder + EWMA
3. **Ensemble decision** → Weighted anomaly score (0-100)
4. **Explanation generated** → "Request rate 340% above baseline"
5. **Rule recommended** → ModSecurity-compatible rule proposed
6. **Admin notified** → Dashboard shows pending approval

### Feedback Loop
1. **Analyst reviews** → Approves/rejects/marks false positive
2. **Feedback stored** → TimescaleDB captures decision
3. **Weekly retraining** → Model improves from feedback
4. **Baseline updates** → EWMA adapts to traffic changes

---

## 🔧 COMPONENT RESPONSIBILITIES

| Component | Responsibility | Why This Choice |
|-----------|---------------|-----------------|
| **NGINX** | TLS termination, traffic routing | Industry standard, battle-tested |
| **ModSecurity** | Rule-based WAF | Open-source, OWASP CRS compatible |
| **Redis Streams** | Async traffic queue | Low-latency, handles bursts |
| **Feature Engine** | Extract ML features | Decoupled, testable |
| **Isolation Forest** | Outlier detection | Fast, no training labels needed |
| **Autoencoder** | Pattern anomalies | Catches complex deviations |
| **EWMA Baseline** | Rate anomalies | Simple, interpretable |
| **TimescaleDB** | Time-series storage | Optimized for metrics |
| **FastAPI** | Backend APIs | Async, fast, typed |
| **React Dashboard** | Admin UI | Modern, real-time capable |

---

## 🛡️ WHY THIS ARCHITECTURE IS RESILIENT

### 1. Fail-Open Design
- If ML pipeline fails → Traffic still flows through WAF
- Redis queue overflow → Oldest entries dropped, not blocked
- Model timeout → Request proceeds, logged for batch analysis

### 2. Async-First
- ML inference happens AFTER request is served
- Zero added latency to user experience
- High-confidence threats can trigger sync blocking (configurable)

### 3. Defense in Depth
- Layer 1: ModSecurity (known attacks)
- Layer 2: ML anomaly detection (unknown attacks)
- Layer 3: Human approval (prevents automation errors)

### 4. Horizontal Scalability
- Stateless feature extraction → Scale with traffic
- Redis cluster → Handle traffic spikes
- Model replicas → Parallel inference

---

## 📈 PERFORMANCE TARGETS

| Metric | Target | How Achieved |
|--------|--------|--------------|
| Added latency | < 5ms (async mode) | Traffic mirroring, not inline |
| Throughput | 10,000 req/sec | Redis buffering, batch inference |
| Detection latency | < 500ms | Streaming feature extraction |
| False positive rate | < 2% | Ensemble + feedback loop |
| Model inference | < 50ms | Optimized sklearn + ONNX |

---

## 🎯 ATTACK DETECTION CAPABILITIES

| Attack Type | Detection Method | Example Signal |
|-------------|------------------|----------------|
| **Zero-day exploits** | Behavioral deviation | "Unusual parameter encoding pattern" |
| **API abuse** | Sequence anomaly | "API call order deviation from baseline" |
| **Bot attacks** | Rate + fingerprint | "Request rate 500% above normal" |
| **Low-and-slow** | Session analysis | "Session duration 10x average" |
| **Credential stuffing** | Login pattern | "Failed auth rate spike from IP range" |
| **Data exfiltration** | Response analysis | "Unusual response size pattern" |

---

## 🔐 SECURITY CONSIDERATIONS

1. **No raw payload storage** → Only statistical features retained
2. **Encrypted at rest** → TimescaleDB with encryption
3. **Audit logging** → All admin actions logged
4. **Role-based access** → Analyst vs Admin permissions
5. **Rule versioning** → Rollback capability for bad rules
