# VARDAx Quick Start Guide

## 🚀 Get Running in 2 Minutes

### Option 1: Single Command (Easiest)

```bash
# Clone the repository
git clone <repo-url>
cd vardax

# Install dependencies
npm install

# Start everything (backend + frontend)
npm run dev
```

Access:
- Dashboard: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Docker

```bash
# Clone and start
git clone <repo-url>
cd vardax
./scripts/quickstart.sh
```

### Option 3: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Train Models:**
```bash
cd backend
python scripts/train_models.py --output ../models
```

---

## 📊 Generate Demo Traffic

```bash
# Install aiohttp
pip install aiohttp

# Run traffic generator (60 seconds, 10% attacks)
python scripts/demo_traffic.py --url http://localhost:8000 --duration 60 --attack-rate 0.1
```

---

## 🧪 Test the API

```bash
# Health check
curl http://localhost:8000/health

# Get anomalies
curl http://localhost:8000/api/v1/anomalies

# Get pending rules
curl http://localhost:8000/api/v1/rules/pending

# Generate rules from anomalies
curl -X POST http://localhost:8000/api/v1/rules/generate
```

---

## 📁 Project Structure

```
vardax/
├── backend/           # FastAPI + ML
│   ├── app/
│   │   ├── api/       # REST endpoints
│   │   ├── ml/        # ML models
│   │   └── models/    # Pydantic schemas
│   └── scripts/       # Training scripts
├── frontend/          # React dashboard
├── nginx/             # WAF config
├── models/            # Trained models
└── scripts/           # Utility scripts
```

---

## 🔧 Configuration

Environment variables (`.env`):
```bash
VARDAX_REDIS_URL=redis://localhost:6379
VARDAX_DATABASE_URL=postgresql://user:pass@localhost:5432/vardax
VARDAX_ANOMALY_THRESHOLD=0.7
```

---

## 🐛 Troubleshooting

**Backend won't start:**
```bash
# Check Python version (need 3.11+)
python --version

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**Frontend errors:**
```bash
# Clear node modules
rm -rf node_modules
npm install
```

**Models not loading:**
```bash
# Retrain models
python scripts/train_models.py --output ../models
```
