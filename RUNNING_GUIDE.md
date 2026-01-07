# 🚀 VARDAx - Quick Operations Guide

All issues have been fixed! VARDAx is now running smoothly.

## ✅ What Was Fixed

1. **Cleaned up stale PID files** - Removed old process IDs that were causing conflicts
2. **Improved port management** - Better cleanup of ports 8001 and 5173
3. **Fixed startup scripts** - Enhanced error handling and process management
4. **Better process isolation** - Proper pkill filters to avoid killing unrelated processes
5. **Added health checks** - Easy way to verify service status

## 🎯 Quick Commands

### Start Services
```bash
# Option 1: Backend + Frontend only (recommended for development)
./start-vardax.sh

# Option 2: Backend + Frontend + ngrok (for public demos)
./start-all.sh

# Option 3: Using npm (alternative)
npm run dev
```

### Check Status
```bash
./check-health.sh
```

### Stop Services
```bash
./stop-all.sh
```

### Verify Setup
```bash
./setup-verify.sh
```

## 📊 Access Points

- **Dashboard**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **API Health**: http://localhost:8001/health
- **ngrok Admin** (if using start-all.sh): http://localhost:4040

## 🔧 Troubleshooting

### Port Already in Use
The scripts now automatically clean up ports before starting. If you still have issues:
```bash
./stop-all.sh
sleep 2
./start-vardax.sh
```

### Check What's Running
```bash
./check-health.sh
```

### View Logs
```bash
# Backend logs
tail -f backend/backend.log

# Frontend logs
tail -f frontend/frontend.log
```

### Manual Process Check
```bash
# Check running processes
ps aux | grep -E "(uvicorn|vite)" | grep -v grep

# Check ports
lsof -i:8001 -i:5173
```

## 🎨 Development Workflow

1. **Start services**: `./start-vardax.sh`
2. **Check health**: `./check-health.sh`
3. **Make changes** to code
4. **Services auto-reload** (backend and frontend have hot reload)
5. **Stop when done**: `./stop-all.sh`

## 📦 Dependencies

All dependencies are already installed and verified:
- ✅ Backend Python virtual environment
- ✅ Frontend npm packages
- ✅ Root dependencies (concurrently)

## 🐛 Common Issues & Solutions

### "Backend not starting"
```bash
cd backend
source venv/bin/activate
python -m pip install -r requirements.txt
```

### "Frontend not starting"
```bash
cd frontend
npm install
```

### "Ports still in use after stopping"
```bash
# Force kill everything
pkill -f "uvicorn app.main"
pkill -f "vite"
fuser -k 8001/tcp 5173/tcp
```

## 🎯 Current Status

✅ **All services running smoothly!**
- Backend: Port 8001 - FastAPI + ML models loaded
- Frontend: Port 5173 - React + Vite hot reload
- All PID files cleaned
- All ports available

## 📝 Script Reference

| Script | Purpose |
|--------|---------|
| `start-vardax.sh` | Start backend + frontend |
| `start-all.sh` | Start backend + frontend + ngrok |
| `stop-all.sh` | Stop all services and clean up |
| `check-health.sh` | Verify service health |
| `setup-verify.sh` | Verify dependencies |

## 💡 Tips

- Use `./start-vardax.sh` for development (lighter, no ngrok)
- Use `./start-all.sh` for demos (includes public URL via ngrok)
- Always run `./check-health.sh` after starting to confirm everything is up
- Run `./stop-all.sh` before closing terminal to clean up properly

---

**Status**: 🟢 All systems operational!
