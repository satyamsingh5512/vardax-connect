#!/bin/bash
# VARDAx Setup Verification Script
# Checks for common issues and missing dependencies

set -e

echo "🔍 VARDAx Setup Verification"
echo "=============================="
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check function
check() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Warning function
warn() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

echo "📦 System Requirements"
echo "----------------------"
check "Node.js" "command -v node"
check "npm" "command -v npm"
check "Python 3" "command -v python3"
check "pip" "command -v pip"

echo ""
echo "📁 Project Structure"
echo "--------------------"
check "Backend directory" "test -d backend"
check "Frontend directory" "test -d frontend"
check "Models directory" "test -d models"
check "Scripts directory" "test -d scripts"

echo ""
echo "🐍 Python Environment"
echo "---------------------"
check "Virtual environment" "test -d backend/venv"
if [ -d "backend/venv" ]; then
    check "httpx installed" "backend/venv/bin/pip list | grep -q httpx"
    check "fastapi installed" "backend/venv/bin/pip list | grep -q fastapi"
    check "scikit-learn installed" "backend/venv/bin/pip list | grep -q scikit-learn"
fi

echo ""
echo "📦 Node.js Dependencies"
echo "-----------------------"
check "Root node_modules" "test -d node_modules"
check "Frontend node_modules" "test -d frontend/node_modules"
warn "Protected demo node_modules" "test -d protected-demo/backend/node_modules"

echo ""
echo "🔧 Configuration Files"
echo "----------------------"
check "Backend main.py" "test -f backend/app/main.py"
check "Backend proxy.py" "test -f backend/app/api/proxy.py"
check "Frontend App.tsx" "test -f frontend/src/App.tsx"
check "VARDAx SDK" "test -f vardax-sdk/vardax-sdk.js"

echo ""
echo "📝 Documentation"
echo "----------------"
check "README.md" "test -f README.md"
check "START_HERE.md" "test -f START_HERE.md"
check "SDK_COMPLETE.md" "test -f SDK_COMPLETE.md"

echo ""
echo "🧪 Optional Components"
echo "----------------------"
warn "ngrok installed" "command -v ngrok"
warn "Docker installed" "command -v docker"
warn "Vercel CLI installed" "command -v vercel"

echo ""
echo "=============================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS optional components missing${NC}"
    fi
    echo ""
    echo "🚀 You're ready to start VARDAx!"
    echo ""
    echo "Quick start:"
    echo "  npm run dev"
    exit 0
else
    echo -e "${RED}✗ $ERRORS critical issues found${NC}"
    echo ""
    echo "Please fix the issues above before starting VARDAx."
    echo ""
    echo "Common fixes:"
    echo "  - Install Node.js: https://nodejs.org"
    echo "  - Install Python 3: https://python.org"
    echo "  - Run: npm install"
    echo "  - Run: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi
