# VardaX DDoS Protection - Incident Runbook

## Table of Contents
1. [Detection](#detection)
2. [Triage](#triage)
3. [Mitigation](#mitigation)
4. [Emergency Procedures](#emergency-procedures)
5. [Rollback](#rollback)
6. [Post-Incident](#post-incident)

---

## Detection

### Alert Thresholds

| Alert | Threshold | Severity | Response Time |
|-------|-----------|----------|---------------|
| High Request Rate | >100k pps | Warning | 5 min |
| DDoS Detected | >50% block rate | Critical | Immediate |
| High Bot Rate | >30% bot blocks | Warning | 10 min |
| Inference Latency | P99 >10ms | Warning | 15 min |
| Service Down | Any component | Critical | Immediate |

### Monitoring Dashboards

1. **Primary Dashboard**: Grafana → VardaX DDoS Protection
2. **Edge Metrics**: Grafana → Envoy Stats
3. **Infrastructure**: Grafana → Kubernetes Overview

### Key Metrics to Watch

```promql
# Request rate
sum(rate(vardax_xdp_packets_total{action="total"}[1m]))

# Block rate percentage
sum(rate(vardax_xdp_packets_total{action="blocked"}[1m])) / 
sum(rate(vardax_xdp_packets_total{action="total"}[1m]))

# Bot detection rate
sum(rate(vardax_bot_inference_requests_total{result="block"}[5m])) /
sum(rate(vardax_bot_inference_requests_total[5m]))

# Inference latency P99
histogram_quantile(0.99, rate(vardax_bot_inference_latency_seconds_bucket[5m]))
```

---

## Triage

### Step 1: Identify Attack Type

```bash
# Check XDP drop reasons
kubectl exec -n vardax-ddos deploy/xdp-manager -- \
  cat /sys/fs/bpf/vardax/counters

# Check top blocked IPs
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli ZREVRANGE vardax:blocked_ips 0 10 WITHSCORES

# Check WAF rule triggers
kubectl logs -n vardax-ddos -l app=waf --tail=100 | \
  jq -r '.rule_id' | sort | uniq -c | sort -rn | head -10
```

### Step 2: Determine Attack Vector

| Symptom | Likely Attack | Mitigation |
|---------|---------------|------------|
| High SYN rate, low established | SYN Flood | Enable SYN cookies, XDP drop |
| High UDP rate | UDP Flood | XDP rate limit, drop |
| High HTTP rate, varied paths | HTTP Flood | Rate limit, challenge |
| Slow connections, high conn count | Slowloris | Connection timeout, limit |
| High bot score, same UA | Bot Attack | Block UA, challenge |
| SQL/XSS patterns | App Attack | WAF rules, block |

### Step 3: Assess Impact

```bash
# Check origin server health
kubectl exec -n vardax-ddos deploy/edge-proxy -- \
  curl -s http://origin-service:8080/health

# Check error rates
kubectl logs -n vardax-ddos -l app=edge-proxy --tail=1000 | \
  jq -r '.status' | sort | uniq -c

# Check latency
kubectl exec -n vardax-ddos deploy/edge-proxy -- \
  curl -w "@curl-format.txt" -o /dev/null -s http://origin-service:8080/
```

---

## Mitigation

### Level 1: Automatic (No Action Required)

The system automatically handles:
- XDP packet filtering (L3/L4)
- Rate limiting per IP
- Bot detection and challenges
- WAF rule enforcement

### Level 2: Increase Protection

```bash
# Increase rate limit strictness
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SET vardax:config:rate_limit_factor 0.5

# Lower bot detection threshold
kubectl exec -n vardax-ddos deploy/bot-detector -- \
  curl -X POST http://localhost:8083/config \
    -d '{"threshold_challenge": 0.4, "threshold_block": 0.7}'

# Enable aggressive WAF mode
kubectl exec -n vardax-ddos deploy/waf -- \
  curl -X POST http://localhost:8084/config \
    -d '{"paranoia_level": 2}'
```

### Level 3: Manual Blocking

```bash
# Block specific IP
kubectl exec -n vardax-ddos deploy/xdp-manager -- \
  python xdp_loader.py --block-ip 1.2.3.4 --duration 3600

# Block IP range (CIDR)
kubectl exec -n vardax-ddos deploy/xdp-manager -- \
  python xdp_loader.py --block-cidr 1.2.3.0/24 --duration 3600

# Block by ASN
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SADD vardax:blocked_asns 12345

# Block by country
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SADD vardax:blocked_countries CN RU
```

### Level 4: Emergency Mode

```bash
# Enable emergency mode (blocks all non-allowlisted traffic)
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SET vardax:emergency_mode 1

# Add critical IPs to allowlist
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SADD vardax:allowlist 10.0.0.1 10.0.0.2

# Scale up edge proxies
kubectl scale -n vardax-ddos deployment/edge-proxy --replicas=20

# Scale up bot detectors
kubectl scale -n vardax-ddos deployment/bot-detector --replicas=10
```

---

## Emergency Procedures

### Procedure 1: Complete Traffic Block

**Use when**: Origin is overwhelmed, need immediate relief

```bash
# 1. Enable maintenance mode at edge
kubectl exec -n vardax-ddos deploy/edge-proxy -- \
  curl -X POST http://localhost:9901/runtime_modify?key=maintenance_mode&value=true

# 2. Return 503 to all traffic
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: maintenance-page
  namespace: vardax-ddos
data:
  index.html: |
    <html><body><h1>Under Maintenance</h1></body></html>
EOF

# 3. Monitor and wait for attack to subside
watch -n 5 'kubectl exec -n vardax-ddos deploy/xdp-manager -- \
  cat /sys/fs/bpf/vardax/counters'
```

### Procedure 2: Geo-Block

**Use when**: Attack originates from specific regions

```bash
# Block countries
for country in CN RU KP IR; do
  kubectl exec -n vardax-ddos deploy/redis -- \
    redis-cli SADD vardax:blocked_countries $country
done

# Verify
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SMEMBERS vardax:blocked_countries
```

### Procedure 3: Challenge All Traffic

**Use when**: Need to filter bots without blocking legitimate users

```bash
# Force challenge for all requests
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SET vardax:force_challenge 1

# Set challenge difficulty
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SET vardax:challenge_difficulty 6
```

### Procedure 4: Upstream Provider Mitigation

**Use when**: Attack exceeds edge capacity

```bash
# Contact upstream provider
# AWS Shield: aws shield create-protection
# Cloudflare: Enable "Under Attack" mode
# GCP: Enable Cloud Armor

# Document attack characteristics for provider
kubectl logs -n vardax-ddos -l app=edge-proxy --since=10m | \
  jq -r '[.client_ip, .method, .path, .user_agent] | @tsv' | \
  sort | uniq -c | sort -rn | head -100 > attack_report.txt
```

---

## Rollback

### Rollback Rate Limits

```bash
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli SET vardax:config:rate_limit_factor 1.0
```

### Rollback Bot Detection

```bash
kubectl exec -n vardax-ddos deploy/bot-detector -- \
  curl -X POST http://localhost:8083/config \
    -d '{"threshold_challenge": 0.5, "threshold_block": 0.8}'
```

### Rollback WAF

```bash
kubectl exec -n vardax-ddos deploy/waf -- \
  curl -X POST http://localhost:8084/config \
    -d '{"paranoia_level": 1}'
```

### Disable Emergency Mode

```bash
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli DEL vardax:emergency_mode

kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli DEL vardax:force_challenge
```

### Clear Blocklists

```bash
# Clear IP blocklist (careful!)
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli DEL vardax:blocked_ips

# Clear country blocks
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli DEL vardax:blocked_countries

# Clear ASN blocks
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli DEL vardax:blocked_asns
```

### Scale Down

```bash
kubectl scale -n vardax-ddos deployment/edge-proxy --replicas=3
kubectl scale -n vardax-ddos deployment/bot-detector --replicas=3
```

---

## Post-Incident

### Step 1: Collect Evidence

```bash
# Export logs
kubectl logs -n vardax-ddos -l app=edge-proxy --since=2h > edge_logs.json
kubectl logs -n vardax-ddos -l app=bot-detector --since=2h > bot_logs.json
kubectl logs -n vardax-ddos -l app=waf --since=2h > waf_logs.json

# Export metrics
curl -G 'http://prometheus:9090/api/v1/query_range' \
  --data-urlencode 'query=vardax_xdp_packets_total' \
  --data-urlencode 'start=2024-01-01T00:00:00Z' \
  --data-urlencode 'end=2024-01-01T02:00:00Z' \
  --data-urlencode 'step=60s' > metrics.json

# Export blocked IPs
kubectl exec -n vardax-ddos deploy/redis -- \
  redis-cli ZRANGE vardax:blocked_ips 0 -1 WITHSCORES > blocked_ips.txt
```

### Step 2: Analyze Attack

```bash
# Top attacking IPs
cat edge_logs.json | jq -r '.client_ip' | sort | uniq -c | sort -rn | head -20

# Top attacking ASNs
cat edge_logs.json | jq -r '.asn' | sort | uniq -c | sort -rn | head -10

# Attack patterns
cat edge_logs.json | jq -r '[.method, .path] | @tsv' | sort | uniq -c | sort -rn | head -20

# User agent analysis
cat edge_logs.json | jq -r '.user_agent' | sort | uniq -c | sort -rn | head -20
```

### Step 3: Update Defenses

Based on analysis:
1. Add new WAF rules for observed patterns
2. Update bot detection model with new attack data
3. Adjust rate limits based on attack characteristics
4. Update blocklists with persistent attackers

### Step 4: Document

Create post-incident report including:
- Timeline of events
- Attack characteristics
- Actions taken
- Impact assessment
- Lessons learned
- Recommended improvements

---

## Contact Information

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| On-Call Engineer | PagerDuty | Immediate |
| Security Team | security@company.com | 15 min |
| Infrastructure Lead | infra-lead@company.com | 30 min |
| Upstream Provider | Support Portal | As needed |

---

## Appendix: Useful Commands

```bash
# Quick health check
kubectl get pods -n vardax-ddos

# Check all services
kubectl get svc -n vardax-ddos

# View recent events
kubectl get events -n vardax-ddos --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n vardax-ddos

# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Port forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```
