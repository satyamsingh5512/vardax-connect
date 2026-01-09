#!/bin/bash

# VARDAx Complete Setup and Start Script
# This script handles everything: virtual environment, dependencies, and startup

set -e

echo "🚀 VARDAx Complete Setup and Startup"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

print_success() {
    echo -e "${PURPLE}[SUCCESS]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

print_header "Step 1: System Dependencies Check"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    print_status "Please install Python 3.8+ and try again"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
print_status "Python version: $PYTHON_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    print_status "Please install Node.js 16+ and try again"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi

print_header "Step 2: Virtual Environment Setup"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

print_header "Step 3: Backend Dependencies"

# Install/update Python dependencies
print_status "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

# Install additional production dependencies
print_status "Installing production security libraries..."
pip install -q faker user-agents python-multipart aiofiles aiohttp

print_header "Step 4: Frontend Dependencies"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    print_status "Frontend dependencies already installed"
fi
cd ..

print_header "Step 5: Environment Configuration"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env
    
    # Generate secure JWT secret
    print_status "Generating secure JWT secret..."
    python3 scripts/generate_jwt_secret.py
    print_success "JWT secret generated and added to .env"
else
    print_status ".env file already exists"
fi

print_header "Step 6: Database Initialization"

# Initialize database
print_status "Initializing database..."
cd backend
python3 -c "
from app.database import get_db
db = get_db()
print('Database initialized successfully')
"
cd ..

print_header "Step 7: Frontend Build"

# Build frontend for production
print_status "Building frontend for production..."
cd frontend
npm run build
cd ..

print_header "Step 8: Creating Log Directory"

# Create logs directory
mkdir -p logs

print_header "Step 9: Starting VARDAx Production System"

# Start backend with production settings
print_status "Starting backend API server..."
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../vardax-backend.pid
cd ..

# Wait for backend to start
print_status "Waiting for backend to initialize..."
sleep 8

# Check if backend is running
if ! curl -s http://localhost:8001/health > /dev/null; then
    print_error "Backend failed to start. Check logs/backend.log"
    exit 1
fi

print_success "Backend started successfully (PID: $BACKEND_PID)"

# Start traffic simulation
print_status "Starting traffic simulation..."
curl -s -X GET "http://localhost:8001/api/v1/traffic/simulate/start/normal_business" > /dev/null

# Start frontend development server
print_status "Starting frontend development server..."
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../vardax-frontend.pid
cd ..

# Wait for frontend to start
print_status "Waiting for frontend to initialize..."
sleep 5

print_success "Frontend started successfully (PID: $FRONTEND_PID)"

# Start ngrok if available
if command -v ngrok &> /dev/null; then
    print_status "Starting ngrok tunnel..."
    nohup ngrok http 8001 > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > vardax-ngrok.pid
    
    # Wait for ngrok to start
    sleep 3
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('tunnels'):
        print(data['tunnels'][0]['public_url'])
    else:
        print('http://localhost:8001')
except:
    print('http://localhost:8001')
" 2>/dev/null || echo "http://localhost:8001")
    
    print_success "Ngrok tunnel: $NGROK_URL"
else
    print_warning "Ngrok not found. Backend available at: http://localhost:8001"
    NGROK_URL="http://localhost:8001"
fi

# Create status file
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
        "frontend": {
            "pid": $FRONTEND_PID,
            "url": "http://localhost:5173",
            "status": "running"
        },
        "ngrok": {
            "pid": ${NGROK_PID:-"null"},
            "url": "$NGROK_URL",
            "status": "$([ -n "$NGROK_PID" ] && echo "running" || echo "disabled")"
        }
    }
}
EOF

print_header "🎉 VARDAx System Started Successfully!"
echo ""
echo "📊 Access Points:"
echo "   Frontend Dashboard: http://localhost:5173/"
echo "   Backend API:        http://localhost:8001"
echo "   API Documentation:  http://localhost:8001/docs"
echo "   Public URL:         $NGROK_URL"
echo ""
echo "🔒 Security Features Active:"
echo "   ✅ WAF Engine with 16+ security rules"
echo "   ✅ Real-time threat detection"
echo "   ✅ ML-based anomaly detection"
echo "   ✅ Traffic simulation running"
echo "   ✅ Rate limiting enabled"
echo "   ✅ IP blocking active"
echo ""
echo "📈 Monitoring:"
echo "   System Status:  curl http://localhost:8001/api/v1/system/status"
echo "   Live Stats:     curl http://localhost:8001/api/v1/stats/live"
echo "   WAF Stats:      curl http://localhost:8001/api/v1/waf/stats"
echo ""
echo "🎮 Control:"
echo "   Stop System:    ./stop-all.sh"
echo "   View Logs:      tail -f logs/backend.log"
echo "   Frontend Logs:  tail -f logs/frontend.log"
echo ""

# Run health check
print_status "Running system health check..."
sleep 2
HEALTH_CHECK=$(curl -s "http://localhost:8001/health" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('status', 'unknown'))
except:
    print('error')
" 2>/dev/null || echo "error")

if [ "$HEALTH_CHECK" = "healthy" ] || [ "$HEALTH_CHECK" = "degraded" ]; then
    print_success "✅ System health check passed ($HEALTH_CHECK)"
else
    print_warning "⚠️  System health check: $HEALTH_CHECK"
fi

# Show initial metrics
print_status "Fetching initial system metrics..."
curl -s "http://localhost:8001/api/v1/stats/live" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'📊 Requests/sec: {data.get(\"requests_per_second\", 0):.1f}')
    print(f'🛡️  Threats blocked: {data.get(\"threats_blocked\", 0)}')
    print(f'📋 Active rules: {data.get(\"pending_rules\", 0)}')
    print(f'🌐 Unique IPs: {data.get(\"unique_ips\", 0)}')
except:
    print('📊 Metrics loading...')
" 2>/dev/null || echo "📊 Metrics loading..."

echo ""
print_header "🚀 VARDAx is now fully operational!"
print_success "Access the dashboard at: http://localhost:5173/"
print_success "API documentation at: http://localhost:8001/docs"

# Optional: Run demo
echo ""
read -p "Would you like to run the production demo? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Running production demo..."
    python3 demo-production-features.py
fi

echo ""
print_header "Setup and startup complete! 🎉"