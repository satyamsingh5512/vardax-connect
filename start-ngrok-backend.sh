#!/bin/bash

# Start ngrok tunnel for VARDAx Backend
echo "🔧 Starting ngrok tunnel for VARDAx Backend..."
echo "Backend API will be accessible at: http://localhost:8000"
echo "Ngrok dashboard: http://localhost:4040"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok tunnel for backend (FastAPI on port 8000)
ngrok http 8000 --log=stdout