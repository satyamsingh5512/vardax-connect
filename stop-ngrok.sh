#!/bin/bash

# Stop all ngrok tunnels and sessions
echo "🛑 Stopping VARDAx ngrok tunnels..."

# Kill tmux session if it exists
if tmux has-session -t ngrok-vardax 2>/dev/null; then
    tmux kill-session -t ngrok-vardax
    echo "✅ Stopped tmux session 'ngrok-vardax'"
fi

# Kill any running ngrok processes
pkill -f ngrok
echo "✅ Stopped all ngrok processes"

# Check if any ngrok processes are still running
if pgrep -f ngrok > /dev/null; then
    echo "⚠️  Some ngrok processes may still be running:"
    pgrep -f ngrok
else
    echo "✅ All ngrok tunnels stopped"
fi