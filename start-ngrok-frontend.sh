#!/bin/bash

# Start ngrok tunnel for VARDAx Frontend
echo "🌐 Starting ngrok tunnel for VARDAx Frontend..."
echo "Frontend will be accessible at: http://localhost:5173"
echo "Ngrok dashboard: http://localhost:4040"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok tunnel for frontend (Vite dev server on port 5173)
ngrok http 5173 --log=stdout