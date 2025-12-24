#!/bin/bash
# VARDAx System Status Check
# Comprehensive health check for all components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
API_URL="${API_URL:-http://localhost:8000}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   VARDAx System Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check service health
check_service() {
    local service=$1
    local container=$2
    
    echo -n "Checking $service... "
    
    if docker-compose -f $COMPOSE_FILE ps | grep -q "$container.*Up"; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Down${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "Checking $name endpoint... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ $response${NC}"
        return 0
    else
        echo -e "${RED}✗ $response (expected $expected_code)${NC}"
        return 1
    fi
}

# Function to check database
check_database() {
    echo -n "Checking PostgreSQL... "
    
    if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U vardax >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        
        # Get database size
        db_size=$(docker-compose -f $COMPOSE_FILE exec -T postgres \
            psql -U vardax -t -c "SELECT pg_size_pretty(pg_database_size('vardax'));" 2>/dev/null | tr -d ' ')
        echo "  Database size: $db_size"
        
        # Get table counts
        anomaly_count=$(docker-compose -f $COMPOSE_FILE exec -T postgres \
            psql -U vardax -t -c "SELECT COUNT(*) FROM anomalies;" 2>/dev/null | tr -d ' ' || echo "N/A")
        echo "  Anomalies: $anomaly_count"
        
        rule_count=$(docker-compose -f $COMPOSE_FILE exec -T postgres \
            psql -U vardax -t -c "SELECT COUNT(*) FROM rules;" 2>/dev/null | tr -d ' ' || echo "N/A")
        echo "  Rules: $rule_count"
        
        return 0
    else
        echo -e "${RED}✗ Not ready${NC}"
        return 1
    fi
}

# Function to check Redis
check_redis() {
    echo -n "Checking Redis... "
    
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        
        # Get memory usage
        mem_used=$(docker-compose -f $COMPOSE_FILE exec -T redis \
            redis-cli INFO memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")
        echo "  Memory used: $mem_used"
        
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

# Function to check ML models
check_ml_models() {
    echo -n "Checking ML models... "
    
    models_exist=true
    for model in "isolation_forest.joblib" "autoencoder.joblib" "ewma_baseline.joblib"; do
        if ! docker-compose -f $COMPOSE_FILE exec -T vardax-backend test -f "/app/models/$model" 2>/dev/null; then
            models_exist=false
            break
        fi
    done
    
    if $models_exist; then
        echo -e "${GREEN}✓ All models present${NC}"
        
        # Get model metadata
        if docker-compose -f $COMPOSE_FILE exec -T vardax-backend test -f "/app/models/metadata.json" 2>/dev/null; then
            version=$(docker-compose -f $COMPOSE_FILE exec -T vardax-backend \
                cat /app/models/metadata.json 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            echo "  Model version: $version"
        fi
        
        return 0
    else
        echo -e "${YELLOW}⚠ Models missing - run training script${NC}"
        return 1
    fi
}

# Function to check system resources
check_resources() {
    echo -e "\n${BLUE}System Resources:${NC}"
    
    # CPU usage
    cpu_usage=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | grep vardax | awk '{sum+=$2} END {print sum}' || echo "N/A")
    echo "  Total CPU usage: ${cpu_usage}%"
    
    # Memory usage
    mem_usage=$(docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | grep vardax | awk '{print $2}' | paste -sd+ | bc 2>/dev/null || echo "N/A")
    echo "  Total memory usage: ${mem_usage}"
    
    # Disk usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    echo "  Disk usage: $disk_usage"
}

# Function to check recent logs for errors
check_logs() {
    echo -e "\n${BLUE}Recent Errors (last 100 lines):${NC}"
    
    error_count=$(docker-compose -f $COMPOSE_FILE logs --tail=100 2>&1 | grep -i "error\|exception\|failed" | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        echo -e "  ${GREEN}✓ No errors found${NC}"
    else
        echo -e "  ${YELLOW}⚠ Found $error_count error messages${NC}"
        echo "  Run 'docker-compose -f $COMPOSE_FILE logs' for details"
    fi
}

# Function to get ML metrics
check_ml_metrics() {
    echo -e "\n${BLUE}ML Performance Metrics:${NC}"
    
    # Try to get metrics from API
    if command -v curl >/dev/null 2>&1; then
        metrics=$(curl -s "$API_URL/api/v1/ml/health" 2>/dev/null)
        
        if [ $? -eq 0 ] && [ -n "$metrics" ]; then
            echo "  Isolation Forest:"
            echo "$metrics" | grep -o '"model_name":"Isolation Forest"[^}]*' | \
                grep -o '"avg_inference_time_ms":[0-9.]*' | cut -d: -f2 | \
                xargs -I {} echo "    Avg inference time: {}ms"
            
            echo "  Autoencoder:"
            echo "$metrics" | grep -o '"model_name":"Autoencoder"[^}]*' | \
                grep -o '"avg_inference_time_ms":[0-9.]*' | cut -d: -f2 | \
                xargs -I {} echo "    Avg inference time: {}ms"
        else
            echo "  ${YELLOW}⚠ Could not fetch metrics${NC}"
        fi
    fi
}

# Main execution
echo -e "${BLUE}Container Status:${NC}"
check_service "NGINX" "vardax-nginx"
check_service "VARDAx Backend" "vardax-ml-backend"
check_service "VARDAx Frontend" "vardax-dashboard"
check_service "Backend App" "vardax-protected-app"
check_service "Redis" "vardax-redis"
check_service "PostgreSQL" "vardax-postgres"

echo ""
echo -e "${BLUE}Service Health:${NC}"
check_endpoint "NGINX" "http://localhost/health"
check_endpoint "VARDAx API" "$API_URL/health"
check_database
check_redis
check_ml_models

check_resources
check_logs
check_ml_metrics

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Status Check Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Exit with error if any critical service is down
if ! docker-compose -f $COMPOSE_FILE ps | grep -q "vardax-nginx.*Up" || \
   ! docker-compose -f $COMPOSE_FILE ps | grep -q "vardax-ml-backend.*Up"; then
    echo -e "${RED}Critical services are down!${NC}"
    exit 1
fi

echo -e "${GREEN}All critical services operational${NC}"
exit 0
