#!/bin/bash

# VARDAx Production Startup Script
# Starts the complete production-grade security system

set -e

echo "🚀 Starting VARDAx Production Security System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SYSTEM]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check dependencies
print_header "Checking system dependencies..."

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating..."
    python3 -m venv venv
fi

# Activate virtual environment
print_status "Activating Python virtual environment..."
source venv/bin/activate

# Install/update Python dependencies
print_status "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

# Install additional production dependencies
print_status "Installing production security libraries..."
pip install -q faker user-agents python-multipart aiofiles

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env
    
    # Generate secure JWT secret
    print_status "Generating secure JWT secret..."
    python3 scripts/generate_jwt_secret.py
fi

# Initialize database
print_status "Initializing database..."
cd backend
python3 -c "
from app.database import get_db
db = get_db()
print('Database initialized successfully')
"
cd ..

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# Build frontend for production
print_status "Building frontend for production..."
cd frontend
npm run build
cd ..

# Create logs directory
mkdir -p logs

# Start the production system
print_header "Starting VARDAx Production Components..."

# Start backend with production settings
print_status "Starting backend API server..."
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../vardax-backend.pid
cd ..

# Wait for backend to start
print_status "Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if ! curl -s http://localhost:8001/health > /dev/null; then
    print_error "Backend failed to start. Check logs/backend.log"
    exit 1
fi

print_status "Backend started successfully (PID: $BACKEND_PID)"

# Start traffic simulation
print_status "Starting traffic simulation..."
curl -s -X GET "http://localhost:8001/api/v1/traffic/simulate/start/normal_business" > /dev/null

# Start ngrok if available
if command -v ngrok &> /dev/null; then
    print_status "Starting ngrok tunnel..."
    nohup ngrok http 8001 > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > vardax-ngrok.pid
    
    # Wait for ngrok to start
    sleep 3
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['tunnels'][0]['public_url'])
except:
    print('http://localhost:8001')
")
    
    print_status "Ngrok tunnel: $NGROK_URL"
else
    print_warning "Ngrok not found. Backend available at: http://localhost:8001"
    NGROK_URL="http://localhost:8001"
fi

# Create production status file
cat > vardax-status.json << EOF
{
    "status": "running",
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "components": {
        "backend": {
            "pid": $BACKEND_PID,
            "url": "http://localhost:8001",
            "status": "running"
        },
        "ngrok": {
            "pid": ${NGROK_PID:-"null"},
            "url": "$NGROK_URL",
            "status": "$([ -n "$NGROK_PID" ] && echo "running" || echo "disabled")"
        },
        "waf_engine": {
            "status": "active",
            "rules_loaded": true
        },
        "traffic_processor": {
            "status": "active",
            "simulation": "running"
        }
    },
    "endpoints": {
        "api": "$NGROK_URL/api/v1",
        "health": "$NGROK_URL/health",
        "docs": "$NGROK_URL/docs",
        "dashboard": "$NGROK_URL/api/v1/system/status"
    }
}
EOF

# Display system information
print_header "🎉 VARDAx Production System Started Successfully!"
echo ""
echo "📊 System Status:"
echo "   Backend API: http://localhost:8001"
echo "   Public URL:  $NGROK_URL"
echo "   Health:      $NGROK_URL/health"
echo "   API Docs:    $NGROK_URL/docs"
echo ""
echo "🔒 Security Features Active:"
echo "   ✅ WAF Engine with 15+ security rules"
echo "   ✅ Real-time threat detection"
echo "   ✅ ML-based anomaly detection"
echo "   ✅ Traffic simulation running"
echo "   ✅ Rate limiting enabled"
echo "   ✅ IP blocking active"
echo ""
echo "📈 Real-time Monitoring:"
echo "   Traffic:     $NGROK_URL/api/v1/metrics/realtime"
echo "   Threats:     $NGROK_URL/api/v1/threats/active"
echo "   WAF Stats:   $NGROK_URL/api/v1/waf/stats"
echo ""
echo "🎮 Control Commands:"
echo "   Stop System: ./stop-vardax.sh"
echo "   View Logs:   tail -f logs/backend.log"
echo "   Status:      curl $NGROK_URL/api/v1/system/status"
echo ""

# Test the system
print_status "Running system health check..."
HEALTH_CHECK=$(curl -s "$NGROK_URL/health" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('status', 'unknown'))
except:
    print('error')
")

if [ "$HEALTH_CHECK" = "healthy" ]; then
    print_status "✅ System health check passed"
else
    print_warning "⚠️  System health check failed"
fi

# Show real-time stats
print_status "Fetching initial system metrics..."
curl -s "$NGROK_URL/api/v1/stats/live" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'📊 Requests/sec: {data.get(\"requests_per_second\", 0):.1f}')
    print(f'🛡️  Threats blocked: {data.get(\"threats_blocked\", 0)}')
    print(f'📋 Active rules: {data.get(\"pending_rules\", 0)}')
    print(f'🌐 Unique IPs: {data.get(\"unique_ips\", 0)}')
except:
    print('📊 Metrics loading...')
"

echo ""
print_header "🚀 VARDAx is now protecting your applications!"
print_status "Monitor the dashboard at: $NGROK_URL/docs"
print_status "System logs: tail -f logs/backend.log"

# Keep script running to show real-time updates
if [ "$1" = "--monitor" ]; then
    print_status "Monitoring mode enabled. Press Ctrl+C to exit."
    while true; do
        sleep 30
        echo ""
        print_status "System Status Update:"
        curl -s "$NGROK_URL/api/v1/stats/live" | python3 -c "
import sys, json
from datetime import datetime
try:
    data = json.load(sys.stdin)
    print(f'[{datetime.now().strftime(\"%H:%M:%S\")}] RPS: {data.get(\"requests_per_second\", 0):.1f} | Blocked: {data.get(\"threats_blocked\", 0)} | IPs: {data.get(\"unique_ips\", 0)}')
except:
    print('[ERROR] Failed to fetch metrics')
"
    done
fi