# VardaX DDoS Protection - Production Architecture

## High-Level Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────────────────────┐
                                    │                     INTERNET TRAFFIC                            │
                                    └─────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         EDGE LAYER (L3/L4)                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                    │
│  │   XDP/eBPF      │  │   SYN Proxy     │  │  Connection     │  │   UDP Rate      │                    │
│  │   Fast Drop     │  │   SYN Cookies   │  │  Queue Manager  │  │   Limiter       │                    │
│  │   (1M+ pps)     │  │                 │  │                 │  │                 │                    │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                    │
│           │                    │                    │                    │                              │
│           └────────────────────┴────────────────────┴────────────────────┘                              │
│                                              │                                                          │
└──────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      REVERSE PROXY LAYER                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              ENVOY / NGINX (TLS Termination)                                     │   │
│  │  • Origin IP Masking          • Connection Pooling        • Cache Headers                        │   │
│  │  • JA3 Fingerprint Extract    • Request Normalization     • Health Checks                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         L7 INSPECTION LAYER                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐         │
│  │  Feature      │  │  Rate         │  │  WAF          │  │  Bot          │  │  Challenge    │         │
│  │  Extractor    │  │  Limiter      │  │  Engine       │  │  Detector     │  │  Manager      │         │
│  │  (Go Sidecar) │  │  (Redis+Lua)  │  │  (OWASP)      │  │  (ML/LightGBM)│  │  (JS/CAPTCHA) │         │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘         │
│          │                  │                  │                  │                  │                  │
│          └──────────────────┴──────────────────┴──────────────────┴──────────────────┘                  │
│                                              │                                                          │
│                                    ┌─────────┴─────────┐                                                │
│                                    │  Decision Engine  │                                                │
│                                    │  (Score + Rules)  │                                                │
│                                    └─────────┬─────────┘                                                │
└──────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      CACHE / ORIGIN SHIELD                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                    VARNISH / NGINX CACHE                                         │   │
│  │  • Cache-Key Design           • Stale-While-Revalidate    • Origin Shield Pattern               │   │
│  │  • Cache Bypass Rules         • Purge API                 • Cache Miss Storm Prevention         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         ORIGIN SERVERS                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                                         │
│  │   Web Server    │  │   API Server    │  │   TCP Service   │                                         │
│  │   (Protected)   │  │   (Protected)   │  │   (Protected)   │                                         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────────────────────────────┐
                                    │           OBSERVABILITY PLANE           │
                                    │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
                                    │  │Prometheus│ │ Kafka   │ │ClickHouse│  │
                                    │  │ Metrics  │ │Telemetry│ │  Logs    │  │
                                    │  └─────────┘ └─────────┘ └───────────┘  │
                                    │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
                                    │  │ Grafana │ │ Alerting│ │ Forensics │  │
                                    │  │Dashboard│ │ Manager │ │  Console  │  │
                                    │  └─────────┘ └─────────┘ └───────────┘  │
                                    └─────────────────────────────────────────┘
```

## Component Responsibilities

### 1. L3/L4 Edge Layer
| Component | Responsibility | Technology | Performance Target |
|-----------|---------------|------------|-------------------|
| XDP/eBPF Fast Drop | Drop malicious packets at NIC driver level | eBPF/XDP, libbpf | 1M+ pps drop rate |
| SYN Proxy | Protect against SYN floods | Linux kernel SYN cookies | 100K+ SYN/s |
| Connection Queue | Manage connection backlog | nftables, tc | 50K concurrent |
| UDP Rate Limiter | Limit UDP amplification | eBPF, nftables | 500K pps |

### 2. Reverse Proxy Layer
| Component | Responsibility | Technology | Performance Target |
|-----------|---------------|------------|-------------------|
| TLS Termination | Decrypt/encrypt traffic | Envoy/Nginx, OpenSSL | 50K TLS handshakes/s |
| Origin IP Masking | Hide origin server IPs | Proxy headers | N/A |
| JA3 Extraction | TLS fingerprinting | Envoy filter, Nginx Lua | <1ms overhead |
| Connection Pooling | Efficient origin connections | HTTP/2, keepalive | 10K connections |

### 3. L7 Inspection Layer
| Component | Responsibility | Technology | Performance Target |
|-----------|---------------|------------|-------------------|
| Feature Extractor | Extract ML features from requests | Go sidecar | <0.5ms latency |
| Rate Limiter | Token bucket rate limiting | Redis + Lua | 100K ops/s |
| WAF Engine | OWASP rule enforcement | ModSecurity/Custom | <2ms latency |
| Bot Detector | ML-based bot classification | LightGBM, ONNX | <2ms inference |
| Challenge Manager | JS/CAPTCHA challenges | FastAPI service | 10K challenges/s |

### 4. Cache/Origin Shield
| Component | Responsibility | Technology | Performance Target |
|-----------|---------------|------------|-------------------|
| Edge Cache | Cache static/dynamic content | Varnish/Nginx | 95%+ hit rate |
| Origin Shield | Collapse cache misses | Single upstream | 10x reduction |
| Purge API | Invalidate cached content | REST API | <100ms propagation |

### 5. Observability Plane
| Component | Responsibility | Technology | Retention |
|-----------|---------------|------------|-----------|
| Metrics | Time-series metrics | Prometheus | 30 days |
| Telemetry | Event streaming | Kafka | 7 days |
| Logs | Structured logging | ClickHouse | 90 days |
| Dashboards | Visualization | Grafana | N/A |
| Alerting | Threshold alerts | Alertmanager | N/A |

## Annotated Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST FLOW WITH COMPONENT ACTIONS                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

1. PACKET ARRIVES AT NIC
   │
   ▼
2. XDP/eBPF FILTER (kernel bypass)
   ├─ Check: IP in blocklist? → DROP
   ├─ Check: Rate exceeded? → DROP  
   ├─ Check: Invalid TCP flags? → DROP
   └─ PASS → Continue to kernel
   │
   ▼
3. KERNEL NETWORK STACK
   ├─ SYN Cookie validation (if SYN flood detected)
   ├─ Connection tracking (conntrack)
   └─ nftables rules (fallback filtering)
   │
   ▼
4. REVERSE PROXY (Envoy/Nginx)
   ├─ TLS termination
   ├─ Extract: JA3 fingerprint, client IP, headers
   ├─ Add: X-Request-ID, X-Forwarded-For
   └─ Forward to L7 inspection
   │
   ▼
5. FEATURE EXTRACTOR (Go sidecar)
   ├─ Extract 47+ features from request
   ├─ Query Redis for session history
   ├─ Build feature vector
   └─ Pass to decision engine
   │
   ▼
6. DECISION ENGINE (parallel evaluation)
   │
   ├─► RATE LIMITER (Redis)
   │   ├─ Check: Per-IP limit
   │   ├─ Check: Per-session limit
   │   ├─ Check: Per-route limit
   │   └─ Return: ALLOW/THROTTLE/BLOCK
   │
   ├─► WAF ENGINE
   │   ├─ Check: OWASP rules
   │   ├─ Check: Custom rules
   │   ├─ Check: Emergency blocklist
   │   └─ Return: ALLOW/BLOCK + rule_id
   │
   ├─► BOT DETECTOR (ML)
   │   ├─ Score: LightGBM model
   │   ├─ Threshold: 0.7 = suspicious
   │   └─ Return: score, is_bot, confidence
   │
   └─► CHALLENGE MANAGER
       ├─ Check: Challenge required?
       ├─ Check: Challenge passed?
       └─ Return: ALLOW/CHALLENGE
   │
   ▼
7. ACTION RESOLUTION
   │
   ├─ BLOCK → Return 403 + log
   ├─ CHALLENGE → Return JS challenge page
   ├─ THROTTLE → Delay response + continue
   └─ ALLOW → Continue to cache
   │
   ▼
8. CACHE LAYER
   ├─ Check: Cache hit? → Return cached response
   ├─ Check: Stale? → Serve stale + revalidate
   └─ Cache miss → Forward to origin shield
   │
   ▼
9. ORIGIN SHIELD
   ├─ Collapse duplicate requests
   ├─ Forward single request to origin
   └─ Cache response
   │
   ▼
10. ORIGIN SERVER
    └─ Process request, return response
   │
   ▼
11. RESPONSE PATH
    ├─ Cache response (if cacheable)
    ├─ Add security headers
    ├─ Log request/response
    └─ Return to client
```

## Decision Matrix

| Rate Limit | WAF | Bot Score | Challenge | Action |
|------------|-----|-----------|-----------|--------|
| OK | OK | <0.5 | Passed | ALLOW |
| OK | OK | 0.5-0.7 | Not passed | CHALLENGE |
| OK | OK | >0.7 | Any | BLOCK |
| OK | BLOCK | Any | Any | BLOCK |
| EXCEEDED | Any | Any | Any | THROTTLE/BLOCK |
| Any | Any | Any | Failed 3x | BLOCK |

## Design Decisions & Trade-offs

### 1. XDP vs iptables for L3/L4
**Decision**: XDP as primary, nftables as fallback
- **Pro**: XDP processes packets before kernel stack (10x faster)
- **Con**: Requires kernel 4.8+, not all NICs support
- **Fallback**: nftables for compatibility

### 2. LightGBM vs Neural Network
**Decision**: LightGBM for production, NN for experimentation
- **Pro**: LightGBM is 10x faster inference, smaller model
- **Con**: Less flexible for complex patterns
- **Hybrid**: Use NN for offline analysis, LightGBM for real-time

### 3. Redis vs In-Memory Rate Limiting
**Decision**: Redis with Lua scripts
- **Pro**: Distributed, persistent, atomic operations
- **Con**: Network latency (~0.5ms)
- **Optimization**: Local cache with Redis sync

### 4. Challenge Types
**Decision**: Progressive escalation (JS → CAPTCHA)
- **Level 1**: Invisible JS proof (no user friction)
- **Level 2**: Browser integrity check
- **Level 3**: CAPTCHA (high friction, high confidence)

### 5. Cache Strategy
**Decision**: Two-tier cache (edge + origin shield)
- **Edge**: Per-node cache for hot content
- **Shield**: Single upstream to collapse misses
- **Trade-off**: Slight latency increase for cache misses
