#!/bin/bash

# VARDAx Ngrok Setup Script
echo "🚀 VARDAx Ngrok Setup"
echo "===================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Ngrok is not installed. Please install ngrok first."
    exit 1
fi

echo "✅ Ngrok is installed ($(ngrok version))"

# Check if auth token is configured
if ! ngrok config check &> /dev/null; then
    echo ""
    echo "⚠️  Ngrok auth token not configured."
    echo "📝 To get started:"
    echo "   1. Sign up for free at: https://ngrok.com"
    echo "   2. Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "   3. Run: ngrok config add-authtoken YOUR_TOKEN_HERE"
    echo ""
    read -p "Do you have an auth token to configure now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your ngrok auth token: " token
        ngrok config add-authtoken "$token"
        echo "✅ Auth token configured!"
    else
        echo "⏭️  Skipping auth token configuration. You can set it up later."
    fi
fi

echo ""
echo "🔧 Ngrok Configuration:"
echo "   Config file: ~/.config/ngrok/ngrok.yml"
echo "   Dashboard: http://localhost:4040 (when running)"
echo ""
echo "🚀 Ready to use ngrok with VARDAx!"
echo ""
echo "📋 Quick Commands:"
echo "   Start frontend tunnel:  ./start-ngrok-frontend.sh"
echo "   Start backend tunnel:   ./start-ngrok-backend.sh"
echo "   Start both tunnels:     ./start-ngrok-all.sh"
echo ""