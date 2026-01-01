# 🚀 VARDAx - Start Here

## Quick Start (2 Minutes)

### Prerequisites
- Python 3.8+ with venv
- Node.js 16+
- npm

### One Command to Rule Them All

```bash
npm run dev
```

That's it! This single command starts:
- ✅ Backend API (FastAPI + ML) on http://localhost:8000
- ✅ Frontend Dashboard (React) on http://localhost:3000

### First Time Setup

```bash
# 1. Install root dependencies
npm install

# 2. Setup Python backend (one-time)
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 3. Install frontend dependencies (one-time)
cd frontend
npm install
cd ..

# 4. Start everything
npm run dev
```

### Alternative: Use the start script

```bash
./start.sh
```

## 📊 Access Points

Once running, open your browser:

- **Dashboard**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **API Health**: http://localhost:8000/health

## 🎯 Available Commands

```bash
npm run dev              # Start both backend and frontend
npm run dev:backend      # Start only backend
npm run dev:frontend     # Start only frontend
```

## 🛠️ Troubleshooting

### Port Already in Use

```bash
# Kill processes on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Kill processes on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Backend Not Starting

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend Not Starting

```bash
cd frontend
npm install
```

## 📚 Next Steps

1. **Explore the Dashboard** - Navigate through all 9 pages
2. **Check Settings** - Go to Settings tab to manage database
3. **Generate Demo Traffic** - Run `python scripts/demo_traffic.py`
4. **Read Documentation** - Check README.md for full details

## 🎨 Dashboard Features

- **Overview** - Live metrics and charts
- **Live Traffic** - Real-time request stream
- **Anomalies** - Detected threats with explanations
- **Rules** - Approve/reject ModSecurity rules
- **Replay** - Timeline of attack sequences
- **Heatmap & Map** - Visual traffic analysis
- **Simulate** - Test rules before deployment
- **ML Health** - Model performance monitoring
- **Settings** - Database and configuration

## 🔥 Demo Mode

To see VARDAx in action with simulated traffic:

```bash
# In a new terminal (while npm run dev is running)
cd backend
source venv/bin/activate
python scripts/demo_traffic.py
```

This will generate realistic attack patterns for demonstration.

---

**Need Help?** Check the full documentation in README.md or QUICKSTART.md
