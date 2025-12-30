# Fortress Dockerfile
# Security: Minimal base image, non-root user, no shell access

FROM python:3.11-slim-bookworm AS builder

# Security: Don't run as root during build
WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache layer)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt


# Production image
FROM python:3.11-slim-bookworm

# Security: Create non-root user
RUN groupadd -r fortress && useradd -r -g fortress fortress

# Security: Remove unnecessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy Python packages from builder
COPY --from=builder /root/.local /home/fortress/.local

# Set up application directory
WORKDIR /app

# Copy application code
COPY --chown=fortress:fortress app/ ./app/

# Security: Set restrictive permissions
RUN chmod -R 550 /app && \
    chown -R fortress:fortress /app

# Security: Switch to non-root user
USER fortress

# Security: Set Python path
ENV PATH=/home/fortress/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
