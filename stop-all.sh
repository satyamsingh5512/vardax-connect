#!/bin/bash
# VARDAx - Stop All Services

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping VARDAx services..."

pkill -f "uvicorn app.main" 2>/dev/null && echo "   ✅ Stopped backend processes" || true
pkill -f "vite.*vardax" 2>/dev/null && echo "   ✅ Stopped frontend processes" || true
pkill -f "ngrok http" 2>/dev/null && echo "   ✅ Stopped ngrok processes" || true

# Kill by PID files with validation
for pidfile in .vardax-backend.pid .vardax-frontend.pid .vardax-ngrok.pid; do
    if [ -f "$PROJECT_DIR/$pidfile" ]; then
        PID=$(cat "$PROJECT_DIR/$pidfile")
        if ps -p "$PID" > /dev/null 2>&1; then
            kill "$PID" 2>/dev/null || true
        fi
        rm "$PROJECT_DIR/$pidfile"
    fi
done

fuser -k 8001/tcp 2>/dev/null && echo "   ✅ Freed port 8001" || true
fuser -k 5173/tcp 2>/dev/null && echo "   ✅ Freed port 5173" || true

echo ""
echo "✅ All services stopped"
