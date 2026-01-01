# VARDAx Production Deployment Guide

This guide walks you through deploying VARDAx in a production environment with all security features enabled.

---

## 🎯 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 50GB+ SSD
- **Network**: Static IP with ports 80/443 accessible

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- OpenSSL (for SSL certificates)
- Git

---

## 📋 Pre-Deployment Checklist

- [ ] Domain name configured and DNS pointing to server
- [ ] SSL/TLS certificates obtained (Let's Encrypt or commercial)
- [ ] Firewall configured (allow 80, 443; block all others)
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
- [ ] Security keys generated (see below)

---

## 🔐 Step 1: Generate Security Keys

```bash
# Generate API key (32+ characters)
openssl rand -hex 32 > .api_key

# Generate JWT secret
openssl rand -hex 32 > .jwt_secret

# Generate database password
openssl rand -base64 32 > .db_password

# Generate Redis password
openssl rand -base64 32 > .redis_password
```

---

## 🔑 Step 2: SSL/TLS Certificates

### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

### Option B: Self-Signed (Development Only)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

---

## ⚙️ Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required changes:**
```bash
VARDAX_API_KEY=<paste from .api_key>
JWT_SECRET=<paste from .jwt_secret>
POSTGRES_PASSWORD=<paste from .db_password>
REDIS_PASSWORD=<paste from .redis_password>
GRAFANA_PASSWORD=<your-grafana-password>

# Update domain
VITE_API_URL=https://your-domain.com/api/v1

# Update backend image
BACKEND_IMAGE=your-registry/your-app:latest
```

---

## 🏗️ Step 4: Train Initial ML Models

```bash
# Activate Python environment
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Train models on sample data
python scripts/train_models.py --samples 10000 --output ../models

# Verify models created
ls -lh ../models/
# Should see: isolation_forest.joblib, autoencoder.joblib, ewma_baseline.joblib
```

---

## 🚀 Step 5: Deploy with Docker Compose

```bash
# Load environment
export $(cat .env.production | xargs)

# Pull images
docker-compose -f docker-compose.prod.yml pull

# Build custom images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## ✅ Step 6: Verify Deployment

### Health Checks

```bash
# NGINX
curl -I https://your-domain.com/health
# Expected: 200 OK

# VARDAx ML API
curl -I https://your-domain.com/vardax-api/health
# Expected: 200 OK

# Dashboard
curl -I https://your-domain.com/vardax/
# Expected: 200 OK
```

### Test ML Inference

```bash
# Get API key
API_KEY=$(cat .api_key)

# Test inference endpoint
curl -X POST https://your-domain.com/vardax-api/ml/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "request_id": "test-001",
    "timestamp": "2024-01-01T00:00:00Z",
    "client_ip": "192.168.1.100",
    "method": "GET",
    "uri": "/api/test",
    "user_agent": "curl/7.68.0",
    "body_length": 0
  }'

# Expected: JSON response with anomaly scores
```

### Test Dashboard Access

1. Open browser: `https://your-domain.com/vardax/`
2. Should see VARDAx dashboard
3. Check all tabs load correctly

---

## 📊 Step 7: Configure Monitoring

### Prometheus

Access: `http://your-server-ip:9090` (internal only)

Verify targets:
- Go to Status → Targets
- All targets should be "UP"

### Grafana

1. Access: `http://your-server-ip:3001`
2. Login: admin / <GRAFANA_PASSWORD>
3. Import dashboards from `monitoring/grafana/dashboards/`

**Key Dashboards:**
- VARDAx Overview
- ML Model Performance
- Traffic Analysis
- Security Events

---

## 🔒 Step 8: Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Verify
sudo ufw status
```

### Fail2Ban (Brute Force Protection)

```bash
# Install
sudo apt-get install fail2ban

# Configure for NGINX
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Add:
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600

# Restart
sudo systemctl restart fail2ban
```

### Automatic Security Updates

```bash
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 🔄 Step 9: Setup Continuous Learning

### Cron Job for Model Retraining

```bash
# Edit crontab
crontab -e

# Add weekly retraining (Sunday 2 AM)
0 2 * * 0 cd /path/to/vardax && docker-compose -f docker-compose.prod.yml exec -T vardax-learner python -m app.ml.continuous_learning >> /var/log/vardax-retrain.log 2>&1
```

### Manual Retraining

```bash
docker-compose -f docker-compose.prod.yml exec vardax-learner \
  python -m app.ml.continuous_learning
```

---

## 📈 Step 10: Performance Tuning

### NGINX Worker Processes

Edit `nginx/nginx-production.conf`:
```nginx
worker_processes auto;  # Use all CPU cores
worker_connections 4096;  # Increase for high traffic
```

### PostgreSQL Tuning

```bash
# Edit postgresql.conf
docker-compose -f docker-compose.prod.yml exec postgres \
  bash -c "echo 'shared_buffers = 2GB' >> /var/lib/postgresql/data/postgresql.conf"

# Restart
docker-compose -f docker-compose.prod.yml restart postgres
```

### Redis Memory Limit

```bash
# Edit docker-compose.prod.yml
# Add to redis service:
command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

---

## 🔍 Monitoring & Alerts

### Log Locations

```bash
# NGINX logs
docker-compose -f docker-compose.prod.yml logs nginx

# VARDAx ML logs
docker-compose -f docker-compose.prod.yml logs vardax-backend

# Database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### Key Metrics to Monitor

1. **Traffic Metrics**
   - Requests per second
   - Response time (p50, p95, p99)
   - Error rate

2. **ML Metrics**
   - Inference latency
   - Anomaly detection rate
   - False positive rate

3. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network bandwidth

### Alert Thresholds

```yaml
# Example Prometheus alerts
groups:
  - name: vardax
    rules:
      - alert: HighAnomalyRate
        expr: rate(vardax_anomalies_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High anomaly detection rate"
      
      - alert: MLInferenceLatency
        expr: vardax_ml_inference_duration_seconds > 0.05
        for: 5m
        annotations:
          summary: "ML inference latency above 50ms"
```

---

## 🆘 Troubleshooting

### Issue: NGINX won't start

```bash
# Check configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Check logs
docker-compose -f docker-compose.prod.yml logs nginx

# Common causes:
# - SSL certificate paths incorrect
# - Port 80/443 already in use
# - ModSecurity rules syntax error
```

### Issue: ML API not responding

```bash
# Check if models loaded
docker-compose -f docker-compose.prod.yml logs vardax-backend | grep "models loaded"

# Check model files exist
docker-compose -f docker-compose.prod.yml exec vardax-backend ls -lh /app/models/

# Retrain if missing
docker-compose -f docker-compose.prod.yml exec vardax-backend \
  python scripts/train_models.py --samples 10000 --output /app/models
```

### Issue: High false positive rate

```bash
# Check current threshold
docker-compose -f docker-compose.prod.yml exec vardax-backend \
  env | grep ANOMALY_THRESHOLD

# Adjust threshold (0.7 = default, 0.8 = stricter)
# Edit .env.production
VARDAX_ANOMALY_THRESHOLD=0.8

# Restart
docker-compose -f docker-compose.prod.yml restart vardax-backend
```

---

## 🔄 Backup & Recovery

### Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/vardax"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U vardax vardax | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup models
tar -czf $BACKUP_DIR/models_$DATE.tar.gz models/

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  .env.production nginx/ monitoring/

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Restore from Backup

```bash
# Restore database
gunzip < /backups/vardax/db_20240101_120000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vardax vardax

# Restore models
tar -xzf /backups/vardax/models_20240101_120000.tar.gz

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check dashboard for anomalies
- Review blocked requests
- Monitor system resources

**Weekly:**
- Review false positives
- Approve/reject pending rules
- Check model performance metrics

**Monthly:**
- Update Docker images
- Review and rotate logs
- Test backup restoration
- Security audit

### Getting Help

- **Documentation**: Check all MD files in project root
- **Logs**: Always check logs first
- **Community**: GitHub Issues
- **Commercial Support**: Contact your security team

---

## 🎓 Best Practices

1. **Never expose admin endpoints publicly**
   - Use VPN or IP allowlisting
   - Require strong authentication

2. **Monitor false positive rate**
   - Target: < 2%
   - Adjust thresholds if higher

3. **Regular model retraining**
   - Weekly minimum
   - After major traffic pattern changes

4. **Test rule changes in staging**
   - Use rule simulator
   - Monitor for 24h before production

5. **Keep security keys secret**
   - Never commit to Git
   - Rotate quarterly

6. **Maintain audit logs**
   - Keep for compliance
   - Review regularly

---

## 📚 Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [ML_DESIGN.md](./ML_DESIGN.md) - ML model details
- [TECH_STACK.md](./TECH_STACK.md) - Technology choices
- [OWASP ModSecurity CRS](https://coreruleset.org/) - WAF rules
- [NGINX Documentation](https://nginx.org/en/docs/)

---

**Deployment Complete! 🎉**

Your VARDAx system is now protecting your application with ML-powered anomaly detection.
