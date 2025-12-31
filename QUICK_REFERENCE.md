# VARDAx - Quick Reference Guide

---

## 🚀 QUICK START (5 MINUTES)

### Option 1: Local Development
```bash
# Clone and setup
git clone https://github.com/satyamsingh5512/vardax.git
cd vardax
npm install

# Start everything
npm run dev

# Access dashboard
open http://localhost:3000
```

### Option 2: Docker
```bash
docker-compose up -d
open http://localhost:3000
```

### Option 3: Cloud (Vercel + Render)
1. Push to GitHub
2. Connect Vercel (frontend)
3. Connect Render (backend)
4. Set environment variables
5. Deploy

---

## 📊 WHAT VARDAx DOES

| Problem | Solution |
|---------|----------|
| Signature-based WAF misses zero-days | Behavioral anomaly detection |
| High false positives | ML ensemble + human approval |
| No learning from attacks | Continuous learning from feedback |
| Manual rule creation | Auto-generated rules |
| No visibility into attacks | Real-time dashboard + forensics |
| L3/L4 DDoS unprotected | XDP/eBPF packet filtering |
| Bot traffic not detected | ML-based bot classification |

---

## 🏗️ ARCHITECTURE IN 30 SECONDS

```
Traffic → NGINX → ModSecurity WAF → Your App
           ↓ (async mirror)
        Redis Queue
           ↓
        Feature Extraction (47 features)
           ↓
        ML Ensemble (3 models)
           ↓
        Anomaly Detection
           ↓
        Rule Recommendation
           ↓
        Admin Dashboard
           ↓
        Deploy to WAF
```

---

## 🧠 ML MODELS EXPLAINED

### Isolation Forest (40% weight)
- **What**: Detects point anomalies (single weird requests)
- **How**: Randomly partitions data; anomalies isolated in fewer splits
- **Speed**: ~5ms inference
- **Example**: Single request with 10x normal body size

### Autoencoder (35% weight)
- **What**: Detects pattern anomalies (unusual combinations)
- **How**: Learns compressed representation; high reconstruction error = anomaly
- **Speed**: ~20ms inference
- **Example**: Normal features individually, but unusual combination

### EWMA Baseline (25% weight)
- **What**: Detects rate anomalies (traffic volume deviations)
- **How**: Exponentially weighted moving average; deviation from baseline = anomaly
- **Speed**: ~1ms inference
- **Example**: Request rate 500% above normal

---

## 📈 47 FEATURES AT A GLANCE

### Request-Level (15)
- URI length, depth, entropy
- Query parameters (count, length, entropy)
- Body (length, entropy, printable ratio)
- File extension risk score
- Header count

### Session-Level (10)
- Request count in session
- Unique URIs accessed
- Unique HTTP methods
- Error rate
- Average response time
- Session duration
- Bytes sent/received
- URI pattern score
- API sequence score

### Rate-Level (8)
- Requests per minute
- Z-score vs baseline
- Unique IPs per minute
- Error rate per minute
- Bytes per minute
- New URI rate
- Auth failure rate
- Rate acceleration

### Behavioral (8)
- User-agent anomaly score
- Geographic anomaly score
- Time-of-day score
- Referrer anomaly score
- Request pattern score
- Payload anomaly score
- Fingerprint consistency
- Bot likelihood score

### API-Specific (6)
- API endpoint encoded
- Parameter deviation
- Response size deviation
- Timing deviation
- Sequence position
- Call frequency

---

## 🎯 ATTACK DETECTION EXAMPLES

### Credential Stuffing
```
Signal: High auth failure rate + high request rate
Detection: EWMA baseline detects rate spike
Action: Rate limit + challenge
```

### Bot Attack
```
Signal: High request rate + no cookies + suspicious UA
Detection: Bot likelihood score + rate anomaly
Action: Challenge or block
```

### Reconnaissance
```
Signal: Many unique URIs + sequential access pattern
Detection: Session unique URIs anomaly
Action: Monitor or rate limit
```

### Zero-Day Exploit
```
Signal: Unusual feature combination not seen before
Detection: Autoencoder reconstruction error
Action: Alert analyst for review
```

### DDoS (L3/L4)
```
Signal: Packet flood at network layer
Detection: XDP/eBPF filter
Action: Drop at NIC (1M+ pps)
```

---

## 🔌 INTEGRATION QUICK START

### npm Package (Node.js/Express)
```javascript
const vardax = require('vardax-connect');

// Add to Express app
app.use(vardax.middleware('vardax://localhost:8000?mode=monitor'));

// That's it! Traffic is now mirrored to VARDAx
```

### Browser SDK
```html
<script src="vardax-sdk.js"></script>
<script>
  VARDAx.init({
    endpoint: 'https://vardax.example.com',
    mode: 'monitor'
  });
</script>
```

### Docker
```bash
docker-compose up -d
# All services running on localhost
```

### ngrok (Remote Testing)
```bash
# Terminal 1: Start VARDAx locally
npm run dev

# Terminal 2: Create ngrok tunnel
ngrok http 8000

# Terminal 3: Use ngrok URL in your app
# vardax://abc123.ngrok.io?mode=monitor
```

---

## 📊 DASHBOARD TOUR

### 1. Overview Tab
- Real-time requests/second
- Anomalies per minute
- Severity distribution
- Top attack types

### 2. Live Traffic Tab
- Real-time request stream
- Anomaly highlighting
- Click to expand details

### 3. Anomalies Tab
- Chronological anomaly list
- Severity filtering
- Confidence scores
- Top explanations

### 4. Rules Tab
- Pending rule recommendations
- Approve/reject/simulate
- Deployed rules history
- Rollback capability

### 5. Models Tab
- Inference latency
- False positive rate
- Model agreement
- Training status

### 6. Settings Tab
- Configuration options
- Threshold tuning
- Feature flags
- Export/import

---

## 🔧 COMMON CONFIGURATIONS

### Increase Detection Sensitivity
```python
# Lower anomaly threshold
VARDAX_ANOMALY_THRESHOLD = 0.5  # Default: 0.7

# Lower EWMA threshold
VARDAX_EWMA_THRESHOLD_STD = 2.0  # Default: 3.0
```

### Reduce False Positives
```python
# Raise anomaly threshold
VARDAX_ANOMALY_THRESHOLD = 0.8  # Default: 0.7

# Increase EWMA threshold
VARDAX_EWMA_THRESHOLD_STD = 4.0  # Default: 3.0

# Increase Isolation Forest contamination
VARDAX_ISOLATION_FOREST_CONTAMINATION = 0.05  # Default: 0.01
```

### Faster Inference
```python
# Reduce feature extraction workers
VARDAX_FEATURE_EXTRACTION_WORKERS = 2  # Default: 4

# Increase batch size
VARDAX_BATCH_SIZE = 200  # Default: 100

# Enable sampling
VARDAX_SAMPLING_RATE = 0.5  # Sample 50% of traffic
```

### Better Accuracy
```python
# Increase feature extraction workers
VARDAX_FEATURE_EXTRACTION_WORKERS = 8  # Default: 4

# Decrease batch size
VARDAX_BATCH_SIZE = 50  # Default: 100

# Disable sampling
VARDAX_SAMPLING_RATE = 1.0  # Process all traffic
```

---

## 📈 MONITORING ESSENTIALS

### Key Metrics to Watch
```
vardax_requests_total              # Total requests processed
vardax_anomalies_detected          # Anomalies detected
vardax_ml_inference_duration_ms    # ML latency
vardax_false_positive_rate         # FP rate
vardax_rules_deployed              # Rules deployed
vardax_cache_hit_rate              # Cache hit rate
vardax_bot_score_distribution      # Bot score histogram
```

### Alert Thresholds
```
Anomaly rate > 10/min              → CRITICAL
ML inference > 100ms               → WARNING
False positive rate > 5%           → WARNING
Cache hit rate < 50%               → WARNING
Database connection lost           → CRITICAL
```

### Grafana Dashboards
1. **Overview**: Key metrics and alerts
2. **Traffic**: Request rate, anomaly rate
3. **ML Models**: Inference latency, accuracy
4. **Rules**: Pending, deployed, rollbacks
5. **Security**: Attack types, top IPs
6. **Performance**: Latency, throughput, resources

---

## 🐛 TROUBLESHOOTING

### Dashboard Not Loading
```bash
# Check backend is running
curl http://localhost:8000/health

# Check frontend is running
curl http://localhost:3000

# Check WebSocket connection
# Open browser console, look for WebSocket errors
```

### No Anomalies Detected
```bash
# Check traffic is being mirrored
# Look for requests in Redis queue
redis-cli XLEN vardax:traffic:queue

# Check ML models are loaded
curl http://localhost:8000/ml/health

# Check feature extraction is working
# Look for logs: "Feature extraction complete"
```

### High False Positive Rate
```bash
# Increase anomaly threshold
VARDAX_ANOMALY_THRESHOLD = 0.8

# Increase EWMA threshold
VARDAX_EWMA_THRESHOLD_STD = 4.0

# Mark false positives in dashboard
# Models will improve from feedback
```

### Slow Inference
```bash
# Check CPU usage
top -p $(pgrep -f uvicorn)

# Increase workers
VARDAX_FEATURE_EXTRACTION_WORKERS = 8

# Enable sampling
VARDAX_SAMPLING_RATE = 0.5

# Check Redis latency
redis-cli --latency
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U user -d vardax -c "SELECT 1"

# Check connection string
echo $VARDAX_DATABASE_URL

# Check network connectivity
telnet localhost 5432
```

---

## 📚 DOCUMENTATION MAP

| Document | Purpose | Read Time |
|----------|---------|-----------|
| README.md | Overview | 5 min |
| QUICKSTART.md | Setup | 5 min |
| ARCHITECTURE.md | Design | 15 min |
| TECH_STACK.md | Technologies | 10 min |
| PRODUCT_DESCRIPTION.md | Features | 10 min |
| DEPLOYMENT.md | Production | 20 min |
| PROJECT_ANALYSIS.md | Complete analysis | 30 min |
| FEATURES_AND_TECH_SUMMARY.md | Summary | 15 min |
| vardax-ddos/RUNBOOK.md | DDoS ops | 20 min |

---

## 🎓 LEARNING PATH

### Beginner (1 hour)
1. Read README.md
2. Run QUICKSTART.md
3. Explore dashboard
4. Try npm package integration

### Intermediate (3 hours)
1. Read ARCHITECTURE.md
2. Read TECH_STACK.md
3. Deploy with Docker
4. Configure monitoring

### Advanced (1 day)
1. Read PRODUCT_DESCRIPTION.md
2. Read PROJECT_ANALYSIS.md
3. Deploy to Kubernetes
4. Integrate with SIEM
5. Customize ML models

### Expert (1 week)
1. Study ML models in detail
2. Understand DDoS protection
3. Contribute to codebase
4. Deploy at scale

---

## 💡 BEST PRACTICES

### Rule Approval
- ✅ Always simulate rules before approval
- ✅ Start with low confidence rules in monitor mode
- ✅ Gradually increase confidence threshold
- ✅ Keep rollback plan ready

### Feedback Loop
- ✅ Mark false positives immediately
- ✅ Provide context in feedback notes
- ✅ Review model health weekly
- ✅ Retrain models after significant feedback

### Monitoring
- ✅ Set up alerts for critical metrics
- ✅ Review dashboards daily
- ✅ Check false positive rate weekly
- ✅ Analyze attack patterns monthly

### Security
- ✅ Rotate JWT secrets regularly
- ✅ Use TLS for all connections
- ✅ Enable audit logging
- ✅ Review access logs monthly

### Performance
- ✅ Monitor inference latency
- ✅ Check cache hit rate
- ✅ Profile feature extraction
- ✅ Optimize database queries

---

## 🔗 USEFUL LINKS

### Documentation
- [README.md](README.md) - Project overview
- [QUICKSTART.md](QUICKSTART.md) - Quick setup
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment

### External Resources
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [scikit-learn Docs](https://scikit-learn.org/)
- [ModSecurity Docs](https://modsecurity.org/)
- [Kubernetes Docs](https://kubernetes.io/docs/)

### Community
- GitHub Issues: Report bugs
- GitHub Discussions: Ask questions
- GitHub Wiki: Community knowledge

---

## 📞 SUPPORT

### Getting Help
1. Check documentation first
2. Search GitHub issues
3. Check troubleshooting section
4. Open GitHub issue with details

### Reporting Bugs
- Include error message
- Include steps to reproduce
- Include environment details
- Include logs if available

### Feature Requests
- Describe use case
- Explain expected behavior
- Provide examples
- Link to related issues

---

## 🎯 NEXT STEPS

1. **Deploy**: Follow QUICKSTART.md
2. **Integrate**: Use npm package or SDK
3. **Monitor**: Set up Prometheus/Grafana
4. **Learn**: Read ARCHITECTURE.md
5. **Customize**: Adjust thresholds and features
6. **Scale**: Deploy to Kubernetes
7. **Contribute**: Submit PRs to improve

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production-Ready

Built with ❤️ for the security community
