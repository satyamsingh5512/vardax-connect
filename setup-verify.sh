#!/bin/bash
# VARDAx - Quick Setup & Verification Script

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛡️  VARDAx - Quick Setup Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend dependencies
echo "🔍 Checking backend setup..."
if [ ! -d "$PROJECT_DIR/backend/venv" ]; then
    echo "❌ Backend virtual environment not found"
    echo "   Creating virtual environment..."
    cd "$PROJECT_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo "✅ Backend dependencies installed"
else
    echo "✅ Backend virtual environment exists"
    # Quick check if dependencies are installed
    if ! "$PROJECT_DIR/backend/venv/bin/python" -c "import fastapi" 2>/dev/null; then
        echo "⚠️  Installing missing backend dependencies..."
        cd "$PROJECT_DIR/backend"
        source venv/bin/activate
        pip install -r requirements.txt
    fi
fi

# Check frontend dependencies
echo "🔍 Checking frontend setup..."
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo "⚠️  Frontend dependencies not found"
    echo "   Installing dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies exist"
fi

# Check root dependencies (concurrently)
echo "🔍 Checking root dependencies..."
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "⚠️  Root dependencies not found"
    echo "   Installing dependencies..."
    cd "$PROJECT_DIR"
    npm install
    echo "✅ Root dependencies installed"
else
    echo "✅ Root dependencies exist"
fi

# Check if ports are free
echo ""
echo "🔍 Checking ports..."
if lsof -i:8001 > /dev/null 2>&1; then
    echo "⚠️  Port 8001 is in use - will clean up on start"
fi
if lsof -i:5173 > /dev/null 2>&1; then
    echo "⚠️  Port 5173 is in use - will clean up on start"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup verification complete!"
echo ""
echo "📋 Available commands:"
echo "   ./start-vardax.sh    - Start backend + frontend"
echo "   ./start-all.sh       - Start backend + frontend + ngrok"
echo "   ./stop-all.sh        - Stop all services"
echo "   ./check-health.sh    - Check service status"
echo "   npm run dev          - Start with concurrently"
echo ""
echo "🚀 Ready to start VARDAx!"
