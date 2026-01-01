#!/bin/bash
# VARDAx Comprehensive Test Suite
# Runs all tests for backend, frontend, and npm packages

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           VARDAx Comprehensive Test Suite                    ║"
echo "║           Testing All Features & Components                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to run a test suite
run_suite() {
    local name=$1
    local command=$2
    local dir=$3
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: ${name}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -n "$dir" ]; then
        pushd "$dir" > /dev/null 2>&1 || true
    fi
    
    if eval "$command"; then
        echo -e "${GREEN}✓ ${name} PASSED${NC}"
        PASSED_SUITES=$((PASSED_SUITES + 1))
    else
        echo -e "${RED}✗ ${name} FAILED${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
    fi
    
    if [ -n "$dir" ]; then
        popd > /dev/null 2>&1 || true
    fi
}

# ============================================================================
# 1. BACKEND PYTHON TESTS
# ============================================================================

echo -e "\n${CYAN}[1/5] Backend Python Tests${NC}"

# Check if Python venv exists
if [ -d "backend/venv" ]; then
    PYTHON="backend/venv/bin/python"
    PIP="backend/venv/bin/pip"
else
    PYTHON="python3"
    PIP="pip3"
fi

# Install test dependencies if needed
echo "Installing test dependencies..."
$PIP install pytest pytest-asyncio httpx > /dev/null 2>&1 || true

# Run ML Models tests
run_suite "ML Models Tests" "$PYTHON -m pytest backend/tests/test_ml_models.py -v --tb=short" ""

# Run Feature Extractor tests
run_suite "Feature Extractor Tests" "$PYTHON -m pytest backend/tests/test_feature_extractor.py -v --tb=short" ""

# Run API Routes tests (if backend is not running, skip)
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    run_suite "API Routes Tests" "$PYTHON -m pytest backend/tests/test_api_routes.py -v --tb=short" ""
else
    echo -e "${YELLOW}⚠ Skipping API Routes tests (backend not running)${NC}"
fi

# ============================================================================
# 2. VARDAX-CONNECT NPM PACKAGE TESTS
# ============================================================================

echo -e "\n${CYAN}[2/5] VARDAx Connect NPM Package Tests${NC}"

# Check if node_modules exists
if [ ! -d "vardax-connect/node_modules" ]; then
    echo "Installing vardax-connect dependencies..."
    npm install --prefix vardax-connect > /dev/null 2>&1 || true
fi

run_suite "VARDAx Connect Basic Tests" "node test/test.js" "vardax-connect"
run_suite "VARDAx Connect Comprehensive Tests" "node test/test-comprehensive.js" "vardax-connect"
run_suite "VARDAx Rate Limiter Tests" "node test/test-rate-limiter.js" "vardax-connect"

# ============================================================================
# 3. FORTRESS MIDDLEWARE TESTS
# ============================================================================

echo -e "\n${CYAN}[3/5] Fortress Middleware Tests${NC}"

if [ -d "fortress" ]; then
    # Install fortress dependencies if needed
    if [ -f "fortress/requirements.txt" ]; then
        $PIP install -r fortress/requirements.txt > /dev/null 2>&1 || true
    fi
    
    run_suite "Fortress Rate Limiter Tests" "$PYTHON -m pytest fortress/tests/test_rate_limiter.py -v --tb=short" ""
    run_suite "Fortress Tarpit Tests" "$PYTHON -m pytest fortress/tests/test_tarpit.py -v --tb=short" ""
else
    echo -e "${YELLOW}⚠ Fortress directory not found, skipping${NC}"
fi

# ============================================================================
# 4. FRONTEND BUILD TEST
# ============================================================================

echo -e "\n${CYAN}[4/5] Frontend Build Test${NC}"

if [ -d "frontend" ]; then
    # Check if node_modules exists
    if [ ! -d "frontend/node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install --prefix frontend > /dev/null 2>&1 || true
    fi
    
    run_suite "Frontend TypeScript Check" "npm run build --prefix frontend 2>&1 | head -50" ""
else
    echo -e "${YELLOW}⚠ Frontend directory not found, skipping${NC}"
fi

# ============================================================================
# 5. INTEGRATION TESTS (if backend is running)
# ============================================================================

echo -e "\n${CYAN}[5/5] Integration Tests${NC}"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    run_suite "API Integration Tests" "bash scripts/integration_test.sh" ""
else
    echo -e "${YELLOW}⚠ Backend not running, skipping integration tests${NC}"
    echo -e "${YELLOW}  Start backend with: npm run dev:backend${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗"
echo -e "║                      TEST SUMMARY                            ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total test suites: ${TOTAL_SUITES}"
echo -e "Passed: ${GREEN}${PASSED_SUITES}${NC}"
echo -e "Failed: ${RED}${FAILED_SUITES}${NC}"
echo ""

if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo -e "║              ✓ ALL TESTS PASSED!                             ║"
    echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗"
    echo -e "║              ✗ SOME TESTS FAILED                             ║"
    echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
