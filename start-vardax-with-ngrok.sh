#!/bin/bash
# VARDAx - Single Command Startup Script with Ngrok
# Usage: ./start-vardax-with-ngrok.sh [--ngrok]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=5173
USE_NGROK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ngrok)
            USE_NGROK=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--ngrok]"
            exit 1
            ;;
    esac
done

echo "🛡️  Starting VARDAx ML-Powered WAF..."
if [ "$USE_NGROK" = true ]; then
    echo "🌐 With Ngrok tunnels enabled"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up stale PID files
echo "🧹 Cleaning up stale processes..."
rm -f "$PROJECT_DIR/.vardax-backend.pid" "$PROJECT_DIR/.vardax-frontend.pid" "$PROJECT_DIR/.vardax-ngrok.pid"

# Kill any existing processes
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite.*vardax" 2>/dev/null || true
if [ "$USE_NGROK" = true ]; then
    pkill -f ngrok 2>/dev/null || true
fi
sleep 2

# Start Backend
echo "🚀 Starting Backend (port $BACKEND_PORT)..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1 || curl -s "http://localhost:$BACKEND_PORT/api/v1/stats/live" > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend may still be starting..."
fi

# Start Frontend
echo "🚀 Starting Frontend (port $FRONTEND_PORT)..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend
sleep 3

# Start Ngrok if requested
NGROK_PID=""
if [ "$USE_NGROK" = true ]; then
    echo "🌐 Starting Ngrok tunnels..."
    
    # Check if ngrok is installed and configured
    if ! command -v ngrok &> /dev/null; then
        echo "❌ Ngrok not found. Please run: ./setup-ngrok.sh"
        exit 1
    fi
    
    # Start ngrok for frontend in background
    ngrok http $FRONTEND_PORT --log=stdout > /tmp/ngrok-frontend.log 2>&1 &
    NGROK_PID=$!
    echo "   Ngrok PID: $NGROK_PID"
    
    # Wait a moment for ngrok to start
    sleep 3
    
    # Try to get the public URL
    if command -v curl &> /dev/null && command -v jq &> /dev/null; then
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
        if [ ! -z "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
            echo "✅ Ngrok tunnel active: $NGROK_URL"
        fi
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VARDAx is running!"
echo ""
echo "📊 Local Dashboard:   http://localhost:$FRONTEND_PORT"
echo "🔌 Local API:         http://localhost:$BACKEND_PORT"
echo "📡 WebSocket:         ws://localhost:$BACKEND_PORT/api/v1/ws/anomalies"

if [ "$USE_NGROK" = true ]; then
    echo ""
    echo "🌐 Public Access:"
    echo "📊 Ngrok Dashboard:   http://localhost:4040"
    echo "🌍 Public URL:        Check ngrok dashboard for public URL"
fi

echo ""
echo "🛑 To stop all services: ./stop-vardax.sh"
if [ "$USE_NGROK" = true ]; then
    echo "🛑 To stop ngrok only:   ./stop-ngrok.sh"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs for cleanup
echo "$BACKEND_PID" > "$PROJECT_DIR/.vardax-backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_DIR/.vardax-frontend.pid"
if [ ! -z "$NGROK_PID" ]; then
    echo "$NGROK_PID" > "$PROJECT_DIR/.vardax-ngrok.pid"
fi

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down VARDAx..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    
    # Clean up PID files
    rm -f "$PROJECT_DIR/.vardax-backend.pid" "$PROJECT_DIR/.vardax-frontend.pid" "$PROJECT_DIR/.vardax-ngrok.pid"
    
    echo "✅ VARDAx stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for processes
wait