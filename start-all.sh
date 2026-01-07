#!/bin/bash
# VARDAx - Complete Startup Script
# Starts: Backend, Frontend, ngrok tunnel, and demo traffic
# Usage: ./start-all.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=5173

echo "🛡️  VARDAx - ML-Powered WAF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
echo "🧹 Cleaning up stale PID files..."
rm -f "$PROJECT_DIR/.vardax-backend.pid" "$PROJECT_DIR/.vardax-frontend.pid" "$PROJECT_DIR/.vardax-ngrok.pid"

echo "🔄 Stopping existing services..."
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite.*vardax" 2>/dev/null || true
pkill -f "ngrok http" 2>/dev/null || true
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
sleep 3

# Start Backend
echo "🚀 Starting Backend (port $BACKEND_PORT)..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT > "$PROJECT_DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PROJECT_DIR/.vardax-backend.pid"

# Wait for backend
sleep 3
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo "✅ Backend running (PID: $BACKEND_PID)"
else
    echo "⚠️  Backend starting..."
fi

# Start Frontend
echo "🚀 Starting Frontend (port $FRONTEND_PORT)..."
cd "$PROJECT_DIR/frontend"
npm run dev > "$PROJECT_DIR/frontend/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PROJECT_DIR/.vardax-frontend.pid"
echo "✅ Frontend running (PID: $FRONTEND_PID)"

# Start ngrok
echo "🌐 Starting ngrok tunnel..."
ngrok http $BACKEND_PORT --log=stdout > "$PROJECT_DIR/ngrok.log" 2>&1 &
NGROK_PID=$!
echo "$NGROK_PID" > "$PROJECT_DIR/.vardax-ngrok.pid"

# Wait for ngrok to establish tunnel
sleep 4
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else '')" 2>/dev/null || echo "")

if [ -n "$NGROK_URL" ]; then
    echo "✅ ngrok running (PID: $NGROK_PID)"
else
    echo "⚠️  ngrok starting... check http://localhost:4040"
    NGROK_URL="(starting...)"
fi

# Print summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VARDAx is running!"
echo ""
echo "📊 Dashboard:     http://localhost:$FRONTEND_PORT"
echo "🔌 Backend API:   http://localhost:$BACKEND_PORT"
echo "🌐 Public URL:    $NGROK_URL"
echo "📡 ngrok Admin:   http://localhost:4040"
echo ""
echo "To stop all services: ./stop-all.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Keep script running to show logs
echo ""
echo "Press Ctrl+C to stop all services..."
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null; exit 0" INT
wait
