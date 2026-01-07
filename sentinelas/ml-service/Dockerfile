# Python ML Service for Sentinelas WAF
# FastAPI + gRPC server with Autoencoder and XGBoost models

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Generate gRPC code from proto
RUN python -m grpc_tools.protoc -I./proto --python_out=./app --grpc_python_out=./app ./proto/waf_ml.proto

# Create models directory
RUN mkdir -p /app/saved_models

# Expose ports
EXPOSE 8000 50051

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start both FastAPI and gRPC servers
CMD ["python", "-m", "app.main"]
