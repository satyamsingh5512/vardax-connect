#!/bin/bash
# Sentinelas Demo Script
# Run on a single laptop to demonstrate the full WAF system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Sentinelas ML-Augmented WAF Demo                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# 1. Check prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is required${NC}"; exit 1; }
echo -e "${GREEN}✓ Prerequisites met${NC}"

# 2. Copy environment file
echo -e "${YELLOW}[2/6] Setting up environment...${NC}"
cd "$PROJECT_DIR"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from template${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi

# 3. Train models (if not exists)
echo -e "${YELLOW}[3/6] Checking ML models...${NC}"
if [ ! -f ml-service/saved_models/autoencoder.pt ]; then
    echo "Training models with synthetic data..."
    cd ml-service
    python training/train_models.py --output-path ./saved_models 2>/dev/null || {
        echo -e "${YELLOW}⚠ Model training skipped (will use untrained fallback)${NC}"
    }
    cd "$PROJECT_DIR"
else
    echo -e "${GREEN}✓ Models already trained${NC}"
fi

# 4. Start services
echo -e "${YELLOW}[4/6] Starting services...${NC}"
docker-compose up -d --build

# Wait for services
echo "Waiting for services to be healthy..."
sleep 10

# Check health
for i in {1..30}; do
    if curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo -e "${GREEN}✓ ML Service healthy${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# 5. Run demo attacks
echo -e "${YELLOW}[5/6] Running demo attacks...${NC}"

# SQL Injection
echo -e "\n${BLUE}Testing SQL Injection...${NC}"
curl -s "http://localhost:8080/search?id=1'+OR+'1'='1" \
    -H "User-Agent: Demo-Client" \
    | head -c 200
echo

# XSS
echo -e "\n${BLUE}Testing XSS...${NC}"
curl -s "http://localhost:8080/comment?text=<script>alert(1)</script>" \
    -H "User-Agent: Demo-Client" \
    | head -c 200
echo

# Path Traversal
echo -e "\n${BLUE}Testing Path Traversal...${NC}"
curl -s "http://localhost:8080/files?path=../../../../etc/passwd" \
    -H "User-Agent: Demo-Client" \
    | head -c 200
echo

# Command Injection
echo -e "\n${BLUE}Testing Command Injection...${NC}"
curl -s "http://localhost:8080/ping?host=127.0.0.1;cat+/etc/passwd" \
    -H "User-Agent: Demo-Client" \
    | head -c 200
echo

# 6. Show dashboard
echo -e "\n${YELLOW}[6/6] Demo complete!${NC}"
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   Demo Services Running                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Dashboard:     http://localhost:3000                        ║${NC}"
echo -e "${GREEN}║  WAF Endpoint:  http://localhost:8080                        ║${NC}"
echo -e "${GREEN}║  ML API:        http://localhost:8000                        ║${NC}"
echo -e "${GREEN}║  ML Health:     http://localhost:8000/health                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}To stop: docker-compose down${NC}"
echo -e "${BLUE}To view logs: docker-compose logs -f${NC}"
