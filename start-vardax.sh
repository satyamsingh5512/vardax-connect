#!/bin/bash
# VARDAx - Single Command Startup Script
# Usage: ./start-vardax.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=5173

echo "🛡️  Starting VARDAx ML-Powered WAF..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing processes on our ports
echo "🔄 Cleaning up existing processes..."
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
sleep 1

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

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VARDAx is running!"
echo ""
echo "📊 Dashboard:  http://localhost:$FRONTEND_PORT"
echo "🔌 API:        http://localhost:$BACKEND_PORT"
echo "📡 WebSocket:  ws://localhost:$BACKEND_PORT/api/v1/ws/anomalies"
echo ""
echo "To stop: Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs for cleanup
echo "$BACKEND_PID" > "$PROJECT_DIR/.vardax-backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_DIR/.vardax-frontend.pid"

# Wait for both processes
wait
