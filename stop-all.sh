#!/bin/bash

# VARDAx Complete Stop Script
# Stops all VARDAx services (backend, frontend, ngrok)

echo "🛑 Stopping VARDAx Complete System..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to kill process by PID file
kill_by_pidfile() {
    local pidfile=$1
    local service_name=$2
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pidfile"
    fi
}

# Stop backend
kill_by_pidfile "vardax-backend.pid" "Backend API"

# Stop frontend
kill_by_pidfile "vardax-frontend.pid" "Frontend Dev Server"

# Stop ngrok
kill_by_pidfile "vardax-ngrok.pid" "Ngrok Tunnel"

# Kill any remaining processes
print_status "Cleaning up remaining processes..."

# Kill any remaining uvicorn processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true

# Kill any remaining npm dev processes
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Kill any remaining ngrok processes
pkill -f "ngrok http" 2>/dev/null || true

# Stop traffic simulation
curl -s -X POST "http://localhost:8001/api/v1/traffic/simulate/stop" > /dev/null 2>&1 || true

# Clean up status file
rm -f vardax-status.json

print_status "✅ VARDAx system stopped"

# Check if any processes are still running
if pgrep -f "uvicorn app.main:app" > /dev/null || pgrep -f "npm run dev" > /dev/null || pgrep -f "ngrok http" > /dev/null; then
    print_error "Some processes may still be running. Check with: ps aux | grep -E '(uvicorn|npm|ngrok)'"
else
    print_status "All VARDAx processes stopped successfully"
fi