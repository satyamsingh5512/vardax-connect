#!/bin/bash
# Script to push files one by one to increase daily commits
# Usage: ./scripts/push-daily-commits.sh

set -e

echo "🚀 VARDAx Daily Commits Script"
echo "================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
    git remote add origin https://github.com/satyamsingh5512/vardax-connect.git
fi

# Array of files to commit (one per day)
declare -a files=(
    # Day 1: Core package files
    "vardax-connect/package.json:feat: add vardax-connect npm package configuration"
    "vardax-connect/index.js:feat: implement vardax-connect middleware core"
    
    # Day 2: TypeScript and docs
    "vardax-connect/index.d.ts:feat: add TypeScript definitions for vardax-connect"
    "vardax-connect/README.md:docs: add comprehensive README for vardax-connect"
    
    # Day 3: Examples
    "vardax-connect/examples/basic.js:docs: add basic usage example"
    "vardax-connect/examples/complete-app.js:docs: add complete app example"
    
    # Day 4: More examples
    "vardax-connect/examples/protect-specific-routes.js:docs: add route protection example"
    "vardax-connect/examples/existing-app.js:docs: add existing app integration example"
    
    # Day 5: Tests
    "vardax-connect/test/test.js:test: add unit tests for vardax-connect"
    "vardax-connect/test/integration-test.js:test: add integration tests"
    
    # Day 6: Quick start guides
    "vardax-connect/QUICK_START.md:docs: add quick start guide"
    "vardax-connect/PUBLISHING_GUIDE.md:docs: add npm publishing guide"
    
    # Day 7: Demo app
    "vardax-connect-demo/package.json:feat: add demo app package configuration"
    "vardax-connect-demo/app.js:feat: implement demo app with vardax-connect"
    
    # Day 8: Demo docs
    "vardax-connect-demo/README.md:docs: add demo app documentation"
    "HOW_TO_USE_VARDAX_CONNECT.md:docs: add usage guide for vardax-connect"
    
    # Day 9: ngrok guides
    "NGROK_SETUP_COMPLETE_GUIDE.md:docs: add complete ngrok setup guide"
    "QUICK_NGROK_SETUP.md:docs: add quick ngrok setup guide"
    
    # Day 10: Checklist and package docs
    "NGROK_CHECKLIST.md:docs: add ngrok setup checklist"
    "NPM_PACKAGE_COMPLETE.md:docs: add npm package documentation"
    
    # Day 11: Additional files
    "vardax-connect/CHANGELOG.md:docs: add changelog"
    "vardax-connect/.npmignore:chore: add npmignore file"
)

# Function to commit and push a single file
commit_file() {
    local file_path=$1
    local commit_msg=$2
    
    if [ -f "$file_path" ]; then
        echo "📝 Committing: $file_path"
        git add "$file_path"
        git commit -m "$commit_msg"
        echo "✅ Committed: $commit_msg"
        echo ""
    else
        echo "⚠️  File not found: $file_path"
        echo ""
    fi
}

# Main execution
echo "Select mode:"
echo "1. Push all files now (multiple commits)"
echo "2. Push one file (for today's commit)"
echo "3. Show remaining files"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Pushing all files..."
        echo ""
        for item in "${files[@]}"; do
            IFS=':' read -r file_path commit_msg <<< "$item"
            commit_file "$file_path" "$commit_msg"
        done
        
        echo "📤 Pushing to GitHub..."
        git push -u origin main
        echo "✅ All files pushed!"
        ;;
        
    2)
        echo "📝 Pushing one file for today..."
        echo ""
        # Get the first uncommitted file
        for item in "${files[@]}"; do
            IFS=':' read -r file_path commit_msg <<< "$item"
            if [ -f "$file_path" ]; then
                # Check if file is already committed
                if ! git ls-files --error-unmatch "$file_path" > /dev/null 2>&1; then
                    commit_file "$file_path" "$commit_msg"
                    echo "📤 Pushing to GitHub..."
                    git push -u origin main
                    echo "✅ Today's commit done!"
                    exit 0
                fi
            fi
        done
        echo "⚠️  All files already committed!"
        ;;
        
    3)
        echo "📋 Remaining files to commit:"
        echo ""
        count=0
        for item in "${files[@]}"; do
            IFS=':' read -r file_path commit_msg <<< "$item"
            if [ -f "$file_path" ]; then
                if ! git ls-files --error-unmatch "$file_path" > /dev/null 2>&1; then
                    count=$((count + 1))
                    echo "$count. $file_path"
                    echo "   → $commit_msg"
                    echo ""
                fi
            fi
        done
        
        if [ $count -eq 0 ]; then
            echo "✅ All files already committed!"
        else
            echo "Total remaining: $count files"
        fi
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
