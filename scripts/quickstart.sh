#!/bin/bash
# VARDAx Quick Start Script
# Run this to get the system up and running quickly

set -e

echo "🛡️  VARDAx Quick Start"
echo "=========================="
echo ""

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed."
        exit 1
    fi
    echo "✅ $1 found"
}

echo "Checking prerequisites..."
check_command docker
check_command docker-compose
echo ""

# Create models directory
echo "Creating directories..."
mkdir -p models
mkdir -p nginx/ssl

# Generate self-signed SSL cert for development
if [ ! -f nginx/ssl/cert.pem ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/CN=localhost" 2>/dev/null || true
fi

# Train ML models
echo ""
echo "Training ML models..."
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || true
pip install -q -r requirements.txt 2>/dev/null || true
python scripts/train_models.py --output ../models --samples 5000 2>/dev/null || echo "⚠️  Model training skipped (will use untrained models)"
cd ..

# Start services
echo ""
echo "Starting services with Docker Compose..."
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo ""
echo "Checking service health..."
curl -s http://localhost:8000/health > /dev/null && echo "✅ Backend API running" || echo "⚠️  Backend not ready yet"
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend running" || echo "⚠️  Frontend not ready yet"

echo ""
echo "🎉 VARDAx is ready!"
echo ""
echo "Access points:"
echo "  📊 Dashboard:  http://localhost:3000"
echo "  🔌 API:        http://localhost:8000"
echo "  📚 API Docs:   http://localhost:8000/docs"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"
