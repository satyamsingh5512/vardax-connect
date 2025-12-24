#!/bin/bash
# Start VARDAx Real Protection Demo

echo "🛡️  Starting VARDAx Real Protection Demo"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Install protected backend dependencies
echo "📦 Installing protected backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# Install VARDAx dependencies
echo "📦 Installing VARDAx dependencies..."
cd ../../backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q httpx
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting services..."
echo ""

# Start protected backend in background
echo "🚀 Starting protected backend on port 4000..."
cd protected-demo/backend
npm start &
BACKEND_PID=$!
cd ../..

# Wait for backend to start
sleep 2

# Start VARDAx
echo "🛡️  Starting VARDAx on port 8000..."
echo ""
npm run dev &
VARDAX_PID=$!

# Wait a bit
sleep 3

echo ""
echo "========================================"
echo "✅ VARDAx Protection is ACTIVE!"
echo "========================================"
echo ""
echo "📊 VARDAx Dashboard: http://localhost:3000"
echo "🛡️  Protected Access:  http://localhost:8000/protected/*"
echo "⚠️  Direct Access:     http://localhost:4000 (UNPROTECTED - Don't use!)"
echo ""
echo "🧪 Test Commands:"
echo "  Normal:  curl http://localhost:8000/protected/api/users"
echo "  Attack:  curl \"http://localhost:8000/protected/api/users?id=1'%20OR%20'1'='1\""
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $VARDAX_PID 2>/dev/null; exit" INT
wait
