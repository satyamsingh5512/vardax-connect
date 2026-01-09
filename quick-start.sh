#!/bin/bash

# VARDAx Quick Start Script
# Assumes dependencies are already installed, just starts the services

set -e

echo "⚡ VARDAx Quick Start"
echo "==================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SYSTEM]${NC} $1"
}

print_success() {
    echo -e "${PURPLE}[SUCCESS]${NC} $1"
}

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run ./setup-and-start.sh first"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Create logs directory
mkdir -p logs

print_header "Starting VARDAx Services"

# Start backend
print_status "Starting backend API server..."
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../vardax-backend.pid
cd ..

# Start frontend
print_status "Starting frontend development server..."
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../vardax-frontend.pid
cd ..

# Start ngrok if available
if command -v ngrok &> /dev/null; then
    print_status "Starting ngrok tunnel..."
    nohup ngrok http 8001 > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > vardax-ngrok.pid
fi

# Wait for services to start
print_status "Waiting for services to initialize..."
sleep 8

# Start traffic simulation
curl -s -X GET "http://localhost:8001/api/v1/traffic/simulate/start/normal_business" > /dev/null 2>&1 || true

# Get ngrok URL if available
if [ -n "${NGROK_PID:-}" ]; then
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
else
    NGROK_URL="http://localhost:8001"
fi

print_header "🚀 VARDAx Started Successfully!"
echo ""
echo "📊 Access Points:"
echo "   Frontend Dashboard: http://localhost:5173/"
echo "   Backend API:        http://localhost:8001"
echo "   API Documentation:  http://localhost:8001/docs"
echo "   Public URL:         $NGROK_URL"
echo ""
echo "🎮 Control:"
echo "   Stop System:    ./stop-all.sh"
echo "   View Logs:      tail -f logs/backend.log"
echo "   Frontend Logs:  tail -f logs/frontend.log"
echo ""

print_success "System is ready! Access dashboard at http://localhost:5173/"