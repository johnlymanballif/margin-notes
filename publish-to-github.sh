#!/bin/bash

# Margin Notes - GitHub Publishing Script
# This script helps you publish your app to GitHub

set -e  # Exit on error

echo "=========================================="
echo "Margin Notes - GitHub Publishing Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "frontend/src-tauri/tauri.conf.json" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found project files"

# Step 2: Get version from tauri.conf.json
VERSION=$(grep -o '"version": "[^"]*"' frontend/src-tauri/tauri.conf.json | cut -d'"' -f4)
echo -e "${GREEN}✓${NC} App version: $VERSION"

# Step 3: Check if git is initialized
if [ ! -d ".git" ]; then
    echo ""
    echo -e "${YELLOW}Initializing git repository...${NC}"
    git init
    git branch -M main
    echo -e "${GREEN}✓${NC} Git repository initialized"
fi

# Step 4: Ask for GitHub username/repo
echo ""
echo "Please enter your GitHub information:"
read -p "GitHub username: " GITHUB_USER
read -p "Repository name (default: margin-notes): " GITHUB_REPO
GITHUB_REPO=${GITHUB_REPO:-margin-notes}

echo ""
echo -e "${YELLOW}Your repository will be:${NC} https://github.com/$GITHUB_USER/$GITHUB_REPO"
read -p "Is this correct? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Aborted."
    exit 0
fi

# Step 5: Check if remote exists
if git remote | grep -q "origin"; then
    echo ""
    echo -e "${YELLOW}Remote 'origin' already exists. Updating...${NC}"
    git remote set-url origin "https://github.com/$GITHUB_USER/$GITHUB_REPO.git"
else
    echo ""
    echo -e "${YELLOW}Adding remote 'origin'...${NC}"
    git remote add origin "https://github.com/$GITHUB_USER/$GITHUB_REPO.git"
fi
echo -e "${GREEN}✓${NC} Remote configured"

# Step 6: Clean up macOS resource fork files
echo ""
echo -e "${YELLOW}Cleaning up macOS resource fork files...${NC}"
find . -type f -name '._*' -delete 2>/dev/null || true
echo -e "${GREEN}✓${NC} Cleanup complete"

# Step 7: Add all files
echo ""
echo -e "${YELLOW}Adding files to git...${NC}"
git add .
echo -e "${GREEN}✓${NC} Files added"

# Step 8: Create commit
echo ""
echo -e "${YELLOW}Creating commit...${NC}"
if git diff --staged --quiet; then
    echo -e "${YELLOW}No changes to commit${NC}"
else
    git commit -m "Margin Notes v$VERSION - Initial commit"
    echo -e "${GREEN}✓${NC} Commit created"
fi

# Step 9: Push to GitHub
echo ""
echo -e "${YELLOW}Pushing to GitHub...${NC}"
echo ""
echo -e "${YELLOW}Note: You may be prompted for your GitHub credentials${NC}"
echo -e "${YELLOW}If you have 2FA enabled, use a Personal Access Token as your password${NC}"
echo ""
read -p "Press Enter to continue..."

if git push -u origin main; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "✓ Successfully pushed to GitHub!"
    echo -e "==========================================${NC}"
    echo ""
    echo "Your repository is now available at:"
    echo -e "${GREEN}https://github.com/$GITHUB_USER/$GITHUB_REPO${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Visit your repository on GitHub"
    echo "2. Go to 'Releases' → 'Create a new release'"
    echo "3. Tag: v$VERSION"
    echo "4. Upload your built app (see GITHUB_SETUP.md for details)"
    echo ""
    echo "Or use GitHub Actions to build automatically:"
    echo "1. Go to 'Actions' tab"
    echo "2. Select 'Build and Test - macOS'"
    echo "3. Click 'Run workflow'"
    echo ""
    echo "For detailed instructions, see GITHUB_SETUP.md"
    echo ""
else
    echo ""
    echo -e "${RED}=========================================="
    echo -e "Push failed!"
    echo -e "==========================================${NC}"
    echo ""
    echo "Common issues:"
    echo ""
    echo "1. Authentication failed:"
    echo "   - Use a Personal Access Token instead of password"
    echo "   - Go to: GitHub → Settings → Developer settings → Personal access tokens"
    echo "   - Create token with 'repo' scope"
    echo ""
    echo "2. Repository doesn't exist:"
    echo "   - Create the repository on GitHub first"
    echo "   - Go to: https://github.com/new"
    echo "   - Name it: $GITHUB_REPO"
    echo "   - Don't initialize with README"
    echo ""
    echo "3. Permission denied:"
    echo "   - Make sure you have write access to the repository"
    echo ""
    echo "For more help, see GITHUB_SETUP.md"
    exit 1
fi

