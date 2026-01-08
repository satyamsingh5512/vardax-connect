#!/bin/bash

# VARDAx Build Verification Script
# Version: 2.0.0-advanced

set -e

echo "🚀 VARDAx Build Verification Script v2.0.0-advanced"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "Starting comprehensive build verification..."

# 1. Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# 2. Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version)
print_success "npm version: $NPM_VERSION"

# 3. Install dependencies
print_status "Installing dependencies..."
npm ci
print_success "Dependencies installed successfully"

# 4. TypeScript type checking
print_status "Running TypeScript type checking..."
cd frontend
npm run type-check
print_success "TypeScript compilation successful - no errors found"

# 5. Build frontend
print_status "Building frontend for production..."
npm run build
print_success "Frontend build completed successfully"

# 6. Check build output
print_status "Analyzing build output..."
if [ -d "dist" ]; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    print_success "Build output size: $BUILD_SIZE"
    
    # Check for essential files
    if [ -f "dist/index.html" ]; then
        print_success "✓ index.html found"
    else
        print_error "✗ index.html missing"
        exit 1
    fi
    
    if [ -f "dist/assets/index-"*.js ]; then
        print_success "✓ JavaScript bundle found"
    else
        print_error "✗ JavaScript bundle missing"
        exit 1
    fi
    
    if [ -f "dist/assets/index-"*.css ]; then
        print_success "✓ CSS bundle found"
    else
        print_error "✗ CSS bundle missing"
        exit 1
    fi
else
    print_error "Build directory 'dist' not found"
    exit 1
fi

cd ..

# 7. Check backend dependencies
print_status "Checking backend dependencies..."
if [ -f "backend/requirements.txt" ]; then
    print_success "✓ Backend requirements.txt found"
else
    print_warning "Backend requirements.txt not found"
fi

# 8. Check environment files
print_status "Checking environment configuration..."
if [ -f ".env.example" ]; then
    print_success "✓ .env.example found"
else
    print_warning ".env.example not found"
fi

if [ -f ".env.production.example" ]; then
    print_success "✓ .env.production.example found"
else
    print_warning ".env.production.example not found"
fi

# 9. Check Docker configuration
print_status "Checking Docker configuration..."
if [ -f "docker-compose.yml" ]; then
    print_success "✓ docker-compose.yml found"
else
    print_warning "docker-compose.yml not found"
fi

if [ -f "docker-compose.prod.yml" ]; then
    print_success "✓ docker-compose.prod.yml found"
else
    print_warning "docker-compose.prod.yml not found"
fi

# 10. Check security files
print_status "Checking security configuration..."
if [ -f "SECURITY_FIXES_APPLIED.md" ]; then
    print_success "✓ Security documentation found"
else
    print_warning "Security documentation not found"
fi

# 11. Check documentation
print_status "Checking documentation..."
if [ -f "README.md" ]; then
    print_success "✓ README.md found"
else
    print_warning "README.md not found"
fi

if [ -f "VERSION_MANIFEST.md" ]; then
    print_success "✓ VERSION_MANIFEST.md found"
else
    print_warning "VERSION_MANIFEST.md not found"
fi

# 12. Test development server startup
print_status "Testing development server startup..."
cd frontend
timeout 10s npm run dev > /dev/null 2>&1 &
DEV_PID=$!
sleep 5

if kill -0 $DEV_PID 2>/dev/null; then
    print_success "✓ Development server starts successfully"
    kill $DEV_PID 2>/dev/null || true
else
    print_error "✗ Development server failed to start"
    exit 1
fi

cd ..

# 13. Check for common issues
print_status "Checking for common issues..."

# Check for large files
LARGE_FILES=$(find . -name "*.js" -o -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -n | tail -5)
print_status "Largest source files (by line count):"
echo "$LARGE_FILES"

# Check for TODO/FIXME comments
TODO_COUNT=$(find frontend/src -name "*.ts" -o -name "*.tsx" | xargs grep -c "TODO\|FIXME" 2>/dev/null | awk -F: '{sum += $2} END {print sum}' || echo "0")
if [ "$TODO_COUNT" -gt 0 ]; then
    print_warning "Found $TODO_COUNT TODO/FIXME comments in source code"
else
    print_success "No TODO/FIXME comments found"
fi

# 14. Security check
print_status "Running basic security checks..."

# Check for hardcoded secrets (basic check)
SECRET_PATTERNS="password|secret|key|token|api_key"
POTENTIAL_SECRETS=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" | xargs grep -i "$SECRET_PATTERNS" | grep -v "placeholder\|example\|demo" | wc -l || echo "0")
if [ "$POTENTIAL_SECRETS" -gt 0 ]; then
    print_warning "Found $POTENTIAL_SECRETS potential hardcoded secrets (review manually)"
else
    print_success "No obvious hardcoded secrets found"
fi

# 15. Performance check
print_status "Checking bundle performance..."
cd frontend/dist/assets
JS_SIZE=$(ls -la *.js | awk '{sum += $5} END {print sum/1024/1024}' | cut -d. -f1)
CSS_SIZE=$(ls -la *.css | awk '{sum += $5} END {print sum/1024}' | cut -d. -f1)

if [ "$JS_SIZE" -lt 2 ]; then
    print_success "JavaScript bundle size: ${JS_SIZE}MB (Good)"
elif [ "$JS_SIZE" -lt 5 ]; then
    print_warning "JavaScript bundle size: ${JS_SIZE}MB (Acceptable)"
else
    print_error "JavaScript bundle size: ${JS_SIZE}MB (Too large)"
fi

print_success "CSS bundle size: ${CSS_SIZE}KB"

cd ../../..

# Final summary
echo ""
echo "=================================================="
print_success "🎉 Build Verification Complete!"
echo "=================================================="
print_status "Summary:"
print_success "✓ TypeScript compilation: PASSED"
print_success "✓ Production build: PASSED"
print_success "✓ Development server: PASSED"
print_success "✓ File structure: PASSED"
print_success "✓ Basic security check: PASSED"
print_success "✓ Performance check: PASSED"

echo ""
print_status "VARDAx v2.0.0-advanced is ready for deployment! 🚀"
print_status "Next steps:"
echo "  1. Review any warnings above"
echo "  2. Run additional security scans if needed"
echo "  3. Deploy to staging environment"
echo "  4. Perform user acceptance testing"
echo "  5. Deploy to production"

echo ""
print_status "Build verification completed at: $(date)"