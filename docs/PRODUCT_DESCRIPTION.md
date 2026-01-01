# VARDAx - Product Description Document

## ML-Enabled Network Anomaly Detection Module for WAF Integration

**Version:** 1.0.0  
**Date:** December 2024  
**Team:** VARDAx Development Team

---

## 1. Executive Summary

VARDAx is a machine learning-powered anomaly detection module designed to augment existing Web Application Firewalls (WAFs). Unlike traditional signature-based approaches, VARDAx learns normal traffic patterns and detects behavioral deviations, enabling detection of zero-day attacks, API abuse, and sophisticated bot traffic.

**Key Differentiators:**
- Behavioral detection (not signature-based)
- Explainable AI with human-readable alerts
- Human-in-the-loop rule approval
- Zero added latency (sidecar architecture)
- Continuous learning from analyst feedback

---

## 2. System Architecture

### 2.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet Traffic                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              NGINX + TLS Termination Layer                   │
│         (Decrypts HTTPS, enables traffic inspection)         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│    ModSecurity WAF      │     │   Traffic Mirror (Async)    │
│  (Existing rule engine) │     │   (Non-blocking copy)       │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│   Backend Application   │     │   VARDAx ML Pipeline    │
│   (Normal operation)    │     │   (Feature → Inference →    │
└─────────────────────────┘     │    Explanation → Rule)      │
                                └─────────────────────────────┘
                                              │
                                              ▼
                                ┌─────────────────────────────┐
                                │    Admin Dashboard          │
                                │  (Review, Approve, Deploy)  │
                                └─────────────────────────────┘
```

### 2.2 Design Principles

1. **Augment, Don't Replace:** VARDAx works alongside existing WAFs, not instead of them.
2. **Fail-Open:** If ML pipeline fails, traffic continues normally through the WAF.
3. **Human-in-the-Loop:** All rule recommendations require admin approval before deployment.
4. **Async Processing:** ML inference happens out-of-band, adding zero latency to requests.

---

## 3. ML Models & Data Pipeline

### 3.1 Feature Extraction

We extract 47 behavioral features from HTTP traffic, grouped into five categories:

| Category | Features | Purpose |
|----------|----------|---------|
| Request-level (15) | URI length, entropy, query params, body stats | Detect injection, malformed requests |
| Session-level (10) | Request count, unique URIs, error rate | Detect multi-request attacks |
| Rate-level (8) | Requests/min, z-score, acceleration | Detect DDoS, brute force |
| Behavioral (8) | User-agent score, bot likelihood, time-of-day | Detect bots, scanners |
| API-specific (6) | Endpoint sequence, param deviation | Detect API abuse |

**Privacy Note:** We never store raw payloads. Only statistical features are retained.

### 3.2 ML Model Ensemble

We use a three-model ensemble for comprehensive anomaly detection:

| Model | Weight | Purpose | Inference Time |
|-------|--------|---------|----------------|
| Isolation Forest | 40% | Point anomalies (single weird requests) | ~5ms |
| Autoencoder | 35% | Pattern anomalies (unusual feature combinations) | ~12ms |
| EWMA Baseline | 25% | Rate anomalies (traffic volume deviations) | ~0.5ms |

**Ensemble Scoring:**
```
Final Score = 0.40 × IF_score + 0.35 × AE_score + 0.25 × EWMA_score
```

### 3.3 Explainability

Every alert includes:
- Per-model anomaly scores
- Top contributing features with deviation percentages
- Human-readable explanation (e.g., "Request rate 340% above baseline")
- Confidence score based on model agreement
- Attack category classification

---

## 4. Rule Integration Logic

### 4.1 Rule Generation Flow

```
ML Anomaly Detection
        │
        ▼
┌───────────────────┐
│ Cluster Similar   │
│ Anomalies         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Extract Common    │
│ Patterns          │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Generate Rule     │
│ + Confidence      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Admin Review      │
│ (Simulate/Approve)│
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Deploy to WAF     │
│ (Versioned)       │
└───────────────────┘
```

### 4.2 Rule Types

| Type | Trigger | Example |
|------|---------|---------|
| IP Block | Multiple anomalies from same IP | Block 192.168.1.100 |
| Rate Limit | High request rate to endpoint | Limit /api/login to 10/min |
| Pattern Match | High entropy/encoding | Block encoded payloads |
| UA Block | Scanner user agents | Block sqlmap, nikto |

### 4.3 ModSecurity Compatibility

Generated rules use standard ModSecurity 3.x syntax:
```apache
SecRule REMOTE_ADDR "@ipMatch 192.168.1.100" \
    "id:9900001,phase:1,deny,status:403,\
    msg:'VARDAx: Suspicious IP - 47 anomalies',\
    tag:'vardax/ip-block',severity:'CRITICAL'"
```

---

## 5. Performance Considerations

### 5.1 Latency Budget

| Component | Target | Achieved |
|-----------|--------|----------|
| Traffic mirroring | <1ms | Async, non-blocking |
| Feature extraction | <10ms | Vectorized NumPy |
| ML inference (total) | <50ms | 18ms combined |
| Rule generation | <100ms | On-demand |

### 5.2 Throughput

- **Design Target:** 10,000 requests/second
- **Bottleneck Mitigation:** Redis queue buffering, batch inference
- **Scaling Strategy:** Horizontal scaling of ML workers

### 5.3 Fail-Safe Behavior

| Scenario | Behavior |
|----------|----------|
| ML service down | Traffic proceeds, logged for batch analysis |
| Queue overflow | Oldest entries dropped (not blocked) |
| Model timeout | Request proceeds, flagged for review |
| High load | Sampling enabled (configurable rate) |

---

## 6. Continuous Learning

### 6.1 Feedback Loop

1. Analyst reviews anomaly in dashboard
2. Marks as True Positive or False Positive
3. Feedback stored with anomaly data
4. False positives update EWMA baseline immediately
5. Weekly batch retraining incorporates all feedback

### 6.2 Model Versioning

- All models versioned with timestamps
- New models run in shadow mode first
- Promotion requires validation against test set
- One-click rollback if issues detected

### 6.3 Drift Detection

- Monitor feature distributions over time
- Alert if baseline shifts significantly
- Automatic retraining trigger on drift

---

## 7. Known Limitations

1. **Cold Start:** New deployments need 24-48 hours to establish accurate baselines.
2. **Encrypted Payloads:** Cannot inspect end-to-end encrypted content (only metadata).
3. **Sophisticated Evasion:** Determined attackers may craft traffic that mimics normal patterns.
4. **Resource Requirements:** ML inference requires dedicated compute resources.

---

## 8. Future Enhancements

1. **Sequence Models:** LSTM/Transformer for API call sequence analysis
2. **Graph Analysis:** IP relationship graphs for coordinated attack detection
3. **Threat Intelligence:** Integration with IP reputation feeds
4. **Multi-Tenant:** SaaS deployment with tenant isolation
5. **SIEM Integration:** Export to Splunk, ELK, or cloud SIEM platforms

---

## 9. Conclusion

VARDAx represents a significant advancement in WAF capabilities by combining traditional rule-based filtering with intelligent ML-driven analysis. The system's behavioral approach enables detection of unknown threats while maintaining operational simplicity through explainable outputs and human-approved rule deployment.

The architecture prioritizes:
- **Security:** Defense-in-depth with human oversight
- **Performance:** Zero-latency sidecar design
- **Usability:** Clear explanations and intuitive dashboard
- **Adaptability:** Continuous learning from analyst feedback

This makes VARDAx suitable for production deployment in high-security environments where both detection accuracy and operational control are critical.

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Classification:** Public
