# VARDAx Startup Guide 🚀

## One-Command Startup System

VARDAx now provides a comprehensive one-command startup system that handles everything from virtual environment setup to running both frontend and backend services.

## 🎯 Quick Start (Recommended)

### **Single Command - Complete Setup**
```bash
./vardax.sh setup
```
This command handles **everything**:
- ✅ Creates Python virtual environment
- ✅ Installs all backend dependencies
- ✅ Installs all frontend dependencies  
- ✅ Generates secure JWT secrets
- ✅ Initializes database
- ✅ Builds frontend for production
- ✅ Starts backend API server
- ✅ Starts frontend development server
- ✅ Starts ngrok tunnel (if available)
- ✅ Runs health checks
- ✅ Starts traffic simulation

### **Quick Start (After Setup)**
```bash
./vardax.sh start
```
For subsequent runs when dependencies are already installed.

## 🎮 Master Control Commands

### **Main Commands**
```bash
./vardax.sh setup     # Complete first-time setup and start
./vardax.sh start     # Quick start (assumes setup done)
./vardax.sh stop      # Stop all services
./vardax.sh restart   # Stop and start again
```

### **Monitoring & Testing**
```bash
./vardax.sh status    # Check system status
./vardax.sh health    # Run health check
./vardax.sh test      # Test WAF blocking
./vardax.sh demo      # Run production demo
```

### **Logs**
```bash
./vardax.sh logs              # Show backend logs
./vardax.sh logs frontend     # Show frontend logs
./vardax.sh logs ngrok        # Show ngrok logs
```

## 📊 Access Points After Startup

### **Local Access**
- **Frontend Dashboard**: http://localhost:5173/
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health

### **Public Access (via Ngrok)**
- **Public URL**: https://[random].ngrok-free.dev
- **API Docs**: https://[random].ngrok-free.dev/docs

## 🔧 Alternative Scripts

If you prefer more control, you can use individual scripts:

### **Complete Setup Script**
```bash
./setup-and-start.sh
```
- Full setup from scratch
- Handles all dependencies
- Interactive demo option

### **Quick Start Script**
```bash
./quick-start.sh
```
- Fast startup for existing setups
- Minimal output
- Background processes

### **Stop Script**
```bash
./stop-all.sh
```
- Stops all VARDAx services
- Cleans up processes
- Removes PID files

## 🚀 First Time Setup Example

```bash
# Clone the repository
git clone <repository-url>
cd vardax-connect

# One command to set up and start everything
./vardax.sh setup

# System will be available at:
# - Frontend: http://localhost:5173/
# - Backend: http://localhost:8001
# - Docs: http://localhost:8001/docs
```

## 🔄 Daily Usage

```bash
# Start VARDAx
./vardax.sh start

# Check status
./vardax.sh status

# Test security features
./vardax.sh test

# Run demo
./vardax.sh demo

# Stop when done
./vardax.sh stop
```

## 📋 System Requirements

### **Required**
- Python 3.8+
- Node.js 16+
- npm

### **Optional**
- ngrok (for public access)
- Redis (for enhanced caching)

## 🛡️ Security Features Active

After startup, VARDAx provides:

- ✅ **WAF Engine** with 16+ security rules
- ✅ **Real-time threat detection**
- ✅ **ML-based anomaly detection**
- ✅ **Traffic simulation** for testing
- ✅ **Rate limiting** and IP blocking
- ✅ **Geographic threat analysis**

## 🎯 Production Ready

The startup system creates a **production-grade deployment** with:

- **Multi-worker backend** (4 workers)
- **Production frontend build**
- **Comprehensive logging**
- **Health monitoring**
- **Automatic service recovery**
- **Public access via ngrok**

## 🔍 Troubleshooting

### **Backend Won't Start**
```bash
./vardax.sh logs
# Check logs/backend.log for errors
```

### **Frontend Issues**
```bash
./vardax.sh logs frontend
# Check logs/frontend.log for errors
```

### **Port Conflicts**
```bash
# Stop all services and restart
./vardax.sh stop
./vardax.sh start
```

### **Clean Restart**
```bash
# Complete clean restart
./vardax.sh stop
rm -rf venv node_modules
./vardax.sh setup
```

## 🎉 Success Indicators

After running `./vardax.sh setup`, you should see:

```
🎉 VARDAx System Started Successfully!

📊 Access Points:
   Frontend Dashboard: http://localhost:5173/
   Backend API:        http://localhost:8001
   API Documentation:  http://localhost:8001/docs
   Public URL:         https://[random].ngrok-free.dev

🔒 Security Features Active:
   ✅ WAF Engine with 16+ security rules
   ✅ Real-time threat detection
   ✅ ML-based anomaly detection
   ✅ Traffic simulation running
   ✅ Rate limiting enabled
   ✅ IP blocking active
```

## 🚀 Ready to Use!

VARDAx is now a **complete, production-ready security system** that can be started with a single command and provides enterprise-grade threat detection and blocking capabilities.

---

**Quick Reference:**
- **First time**: `./vardax.sh setup`
- **Daily use**: `./vardax.sh start`
- **Stop**: `./vardax.sh stop`
- **Status**: `./vardax.sh status`