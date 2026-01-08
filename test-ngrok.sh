#!/bin/bash

# Quick test script for ngrok setup
echo "🧪 Testing VARDAx Ngrok Setup"
echo "============================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok not found. Run: ./setup-ngrok.sh"
    exit 1
fi

echo "✅ Ngrok is installed: $(ngrok version)"

# Check if auth token is configured
if ngrok config check &> /dev/null; then
    echo "✅ Ngrok is authenticated"
else
    echo "⚠️  Ngrok authentication required"
    echo "   Run: ngrok config add-authtoken YOUR_TOKEN"
fi

# Check if config file exists
if [ -f ~/.config/ngrok/ngrok.yml ]; then
    echo "✅ Ngrok config file exists"
else
    echo "⚠️  Ngrok config file missing. Run: ./configure-ngrok.sh"
fi

# Test a simple tunnel (quick test)
echo ""
echo "🚀 Testing tunnel creation..."
echo "   Starting test tunnel on port 8080..."

# Start a simple HTTP server for testing
python3 -m http.server 8080 --directory . > /dev/null 2>&1 &
SERVER_PID=$!

# Give server time to start
sleep 2

# Start ngrok tunnel
timeout 10s ngrok http 8080 --log=stdout > /tmp/ngrok-test.log 2>&1 &
NGROK_PID=$!

# Wait a moment for ngrok to start
sleep 5

# Check if tunnel is active
if curl -s http://localhost:4040/api/tunnels | grep -q "public_url"; then
    echo "✅ Ngrok tunnel test successful!"
    
    # Try to get the URL
    if command -v jq &> /dev/null; then
        TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null)
        if [ ! -z "$TUNNEL_URL" ] && [ "$TUNNEL_URL" != "null" ]; then
            echo "🌐 Test tunnel URL: $TUNNEL_URL"
        fi
    fi
else
    echo "⚠️  Tunnel test failed. Check logs:"
    echo "   tail -f /tmp/ngrok-test.log"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true
kill $NGROK_PID 2>/dev/null || true

echo ""
echo "🎯 Ngrok setup test complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start VARDAx: ./start-vardax.sh"
echo "   2. Start with ngrok: ./start-vardax-with-ngrok.sh --ngrok"
echo "   3. View dashboard: http://localhost:4040"