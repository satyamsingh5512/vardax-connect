#!/bin/bash
# VARDAx - Stop Script

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping VARDAx..."

# Kill by PID files
if [ -f "$PROJECT_DIR/.vardax-backend.pid" ]; then
    kill $(cat "$PROJECT_DIR/.vardax-backend.pid") 2>/dev/null || true
    rm "$PROJECT_DIR/.vardax-backend.pid"
fi

if [ -f "$PROJECT_DIR/.vardax-frontend.pid" ]; then
    kill $(cat "$PROJECT_DIR/.vardax-frontend.pid") 2>/dev/null || true
    rm "$PROJECT_DIR/.vardax-frontend.pid"
fi

# Also kill by port
fuser -k 8001/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

echo "✅ VARDAx stopped"
