#!/bin/bash
# VARDAx - Stop All Services

echo "🛑 Stopping VARDAx services..."

pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true

# Kill by PID files
for pidfile in .vardax-backend.pid .vardax-frontend.pid .vardax-ngrok.pid; do
    if [ -f "$pidfile" ]; then
        kill $(cat "$pidfile") 2>/dev/null || true
        rm "$pidfile"
    fi
done

fuser -k 8001/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

echo "✅ All services stopped"
