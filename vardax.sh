#!/bin/bash

# VARDAx Master Control Script
# One command to rule them all

echo "🔥 VARDAx Master Control"
echo "======================="

case "$1" in
    "setup"|"install"|"first-run")
        echo "🚀 Running complete setup and start..."
        ./setup-and-start.sh
        ;;
    "start"|"run")
        echo "⚡ Quick starting VARDAx..."
        ./quick-start.sh
        ;;
    "stop"|"kill")
        echo "🛑 Stopping VARDAx..."
        ./stop-all.sh
        ;;
    "restart")
        echo "🔄 Restarting VARDAx..."
        ./stop-all.sh
        sleep 2
        ./quick-start.sh
        ;;
    "demo")
        echo "🎭 Running production demo..."
        source venv/bin/activate 2>/dev/null || true
        python3 demo-production-features.py
        ;;
    "status")
        echo "📊 Checking VARDAx status..."
        if curl -s http://localhost:8001/health > /dev/null 2>&1; then
            echo "✅ Backend: Running"
            curl -s http://localhost:8001/api/v1/system/status | python3 -m json.tool 2>/dev/null || echo "API responding"
        else
            echo "❌ Backend: Not running"
        fi
        
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo "✅ Frontend: Running"
        else
            echo "❌ Frontend: Not running"
        fi
        ;;
    "logs")
        echo "📋 Showing logs..."
        if [ "$2" = "frontend" ]; then
            tail -f logs/frontend.log 2>/dev/null || echo "Frontend logs not found"
        elif [ "$2" = "ngrok" ]; then
            tail -f logs/ngrok.log 2>/dev/null || echo "Ngrok logs not found"
        else
            tail -f logs/backend.log 2>/dev/null || echo "Backend logs not found"
        fi
        ;;
    "health")
        echo "🏥 Health check..."
        curl -s http://localhost:8001/health | python3 -m json.tool 2>/dev/null || echo "Health check failed"
        ;;
    "test")
        echo "🧪 Testing WAF..."
        curl -s -X POST http://localhost:8001/api/v1/traffic/process \
          -H "Content-Type: application/json" \
          -d '{"client_ip": "203.0.113.100", "method": "GET", "uri": "/admin?cmd=rm -rf /", "headers": {"User-Agent": "sqlmap/1.7.2"}}' \
          | python3 -m json.tool 2>/dev/null || echo "WAF test failed"
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|restart|demo|status|logs|health|test}"
        echo ""
        echo "Commands:"
        echo "  setup     - Complete setup and start (first time)"
        echo "  start     - Quick start (assumes setup done)"
        echo "  stop      - Stop all services"
        echo "  restart   - Stop and start again"
        echo "  demo      - Run production demo"
        echo "  status    - Check system status"
        echo "  logs      - Show backend logs (add 'frontend' or 'ngrok' for others)"
        echo "  health    - Run health check"
        echo "  test      - Test WAF blocking"
        echo ""
        echo "Examples:"
        echo "  $0 setup          # First time setup and start"
        echo "  $0 start          # Quick start"
        echo "  $0 logs frontend  # Show frontend logs"
        echo "  $0 demo           # Run demo"
        exit 1
        ;;
esac