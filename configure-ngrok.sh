#!/bin/bash

# VARDAx Ngrok Configuration Script
echo "🔧 VARDAx Ngrok Configuration"
echo "============================"

# Create ngrok config directory if it doesn't exist
mkdir -p ~/.config/ngrok

# Check if config file exists
if [ -f ~/.config/ngrok/ngrok.yml ]; then
    echo "📁 Existing ngrok config found at ~/.config/ngrok/ngrok.yml"
    read -p "Do you want to backup and replace it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp ~/.config/ngrok/ngrok.yml ~/.config/ngrok/ngrok.yml.backup
        echo "✅ Backup created: ~/.config/ngrok/ngrok.yml.backup"
    else
        echo "⏭️  Keeping existing configuration"
        exit 0
    fi
fi

# Copy our configuration
cp ngrok.yml ~/.config/ngrok/ngrok.yml
echo "✅ VARDAx ngrok configuration installed"

# Check auth token
echo ""
echo "🔑 Checking authentication..."
if ngrok config check &> /dev/null; then
    echo "✅ Ngrok is properly authenticated"
else
    echo "⚠️  Authentication required"
    echo ""
    echo "📝 To authenticate ngrok:"
    echo "   1. Sign up at: https://ngrok.com"
    echo "   2. Get your token: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "   3. Run: ngrok config add-authtoken YOUR_TOKEN_HERE"
    echo ""
    read -p "Enter your auth token now (or press Enter to skip): " token
    if [ ! -z "$token" ]; then
        ngrok config add-authtoken "$token"
        echo "✅ Auth token configured!"
    fi
fi

echo ""
echo "🚀 Configuration complete!"
echo ""
echo "📋 Available commands:"
echo "   Start frontend tunnel:    ./start-ngrok-frontend.sh"
echo "   Start backend tunnel:     ./start-ngrok-backend.sh"
echo "   Start both tunnels:       ./start-ngrok-all.sh"
echo "   Named tunnel (frontend):  ngrok start vardax-frontend"
echo "   Named tunnel (backend):   ngrok start vardax-backend"
echo ""
echo "📊 Ngrok dashboard will be available at: http://localhost:4040"