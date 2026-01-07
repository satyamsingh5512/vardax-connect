#!/bin/bash
# VARDAx - Health Check Script
# Checks if all services are running properly

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=5173

echo "🏥 VARDAx Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend
echo -n "🔌 Backend (port $BACKEND_PORT): "
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1 || \
   curl -s "http://localhost:$BACKEND_PORT/api/v1/stats/live" > /dev/null 2>&1; then
    echo "✅ Running"
    BACKEND_OK=1
else
    echo "❌ Not responding"
    BACKEND_OK=0
fi

# Check frontend
echo -n "📊 Frontend (port $FRONTEND_PORT): "
if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "✅ Running"
    FRONTEND_OK=1
else
    echo "❌ Not responding"
    FRONTEND_OK=0
fi

# Check ngrok (optional)
echo -n "🌐 ngrok tunnel: "
if curl -s "http://localhost:4040/api/tunnels" > /dev/null 2>&1; then
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else 'N/A')" 2>/dev/null || echo "N/A")
    echo "✅ Running ($NGROK_URL)"
else
    echo "⚠️  Not running (optional)"
fi

# Check processes
echo ""
echo "📋 Process Status:"
if [ -f "$PROJECT_DIR/.vardax-backend.pid" ]; then
    PID=$(cat "$PROJECT_DIR/.vardax-backend.pid")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "   Backend PID $PID: ✅ Active"
    else
        echo "   Backend PID $PID: ❌ Stale (process not running)"
    fi
fi

if [ -f "$PROJECT_DIR/.vardax-frontend.pid" ]; then
    PID=$(cat "$PROJECT_DIR/.vardax-frontend.pid")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "   Frontend PID $PID: ✅ Active"
    else
        echo "   Frontend PID $PID: ❌ Stale (process not running)"
    fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$BACKEND_OK" -eq 1 ] && [ "$FRONTEND_OK" -eq 1 ]; then
    echo "✅ All critical services are running"
    echo ""
    echo "📊 Dashboard:  http://localhost:$FRONTEND_PORT"
    echo "🔌 API:        http://localhost:$BACKEND_PORT"
    exit 0
else
    echo "❌ Some services are not running"
    echo ""
    echo "To start services:"
    echo "   ./start-vardax.sh   (Backend + Frontend)"
    echo "   ./start-all.sh      (Backend + Frontend + ngrok)"
    exit 1
fi
