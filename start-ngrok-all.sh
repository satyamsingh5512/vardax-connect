#!/bin/bash

# Start ngrok tunnels for both VARDAx Frontend and Backend
echo "🚀 Starting ngrok tunnels for VARDAx (Frontend + Backend)..."
echo ""

# Check if tmux is available for running multiple sessions
if command -v tmux &> /dev/null; then
    echo "📱 Using tmux to manage multiple tunnels..."
    
    # Kill existing ngrok sessions if any
    tmux kill-session -t ngrok-vardax 2>/dev/null || true
    
    # Create new tmux session
    tmux new-session -d -s ngrok-vardax
    
    # Split window and start backend tunnel
    tmux send-keys -t ngrok-vardax "echo 'Starting Backend Tunnel (Port 8000)...'; ngrok http 8000" Enter
    
    # Split window and start frontend tunnel
    tmux split-window -t ngrok-vardax
    tmux send-keys -t ngrok-vardax "echo 'Starting Frontend Tunnel (Port 5173)...'; ngrok http 5173" Enter
    
    # Attach to session
    echo "✅ Tunnels started in tmux session 'ngrok-vardax'"
    echo "📊 Ngrok dashboard: http://localhost:4040"
    echo "🌐 Frontend tunnel: Check ngrok dashboard for URL"
    echo "🔧 Backend tunnel: Check ngrok dashboard for URL"
    echo ""
    echo "Commands:"
    echo "  View tunnels: tmux attach -t ngrok-vardax"
    echo "  Stop tunnels: tmux kill-session -t ngrok-vardax"
    echo ""
    
    tmux attach -t ngrok-vardax
else
    echo "⚠️  tmux not found. Please install tmux or run tunnels separately:"
    echo "   ./start-ngrok-frontend.sh (in one terminal)"
    echo "   ./start-ngrok-backend.sh (in another terminal)"
    echo ""
    echo "Installing tmux..."
    sudo apt update && sudo apt install -y tmux
    
    if command -v tmux &> /dev/null; then
        echo "✅ tmux installed! Re-running script..."
        exec "$0"
    else
        echo "❌ Failed to install tmux. Please run tunnels manually."
        exit 1
    fi
fi