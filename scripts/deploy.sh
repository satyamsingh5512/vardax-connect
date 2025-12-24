#!/bin/bash
# VARDAx Deployment Script

set -e

echo "🚀 VARDAx Deployment Script"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating from template..."
    cp .env.example .env
    echo "✅ Please edit .env with your configuration"
    echo "Then run this script again."
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: DB_PASSWORD and JWT_SECRET must be set in .env"
    exit 1
fi

echo "📦 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

echo ""
echo "🔄 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo ""
echo "🏥 Health Check:"
echo "----------------"

# Check backend
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend: Healthy"
else
    echo "❌ Backend: Not responding"
fi

# Check database
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U vardax > /dev/null 2>&1; then
    echo "✅ Database: Healthy"
else
    echo "❌ Database: Not responding"
fi

# Check Redis
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Healthy"
else
    echo "❌ Redis: Not responding"
fi

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📍 Services:"
echo "   - NGINX/WAF: http://localhost:80"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "📊 View logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f docker-compose.prod.yml down"
echo ""
