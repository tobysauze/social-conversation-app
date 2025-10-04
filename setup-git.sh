#!/bin/bash

# Social Conversation App - Git Setup Script
echo "🚀 Setting up Git repository for deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📝 Adding files to Git..."
git add .

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: Social Conversation App ready for deployment"

echo ""
echo "✅ Git repository is ready!"
echo ""
echo "Next steps:"
echo "1. Create a new repository on GitHub"
echo "2. Run these commands (replace YOUR_USERNAME and REPO_NAME):"
echo "   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git"
echo "   git push -u origin main"
echo ""
echo "3. Follow the DEPLOYMENT.md guide to deploy to Vercel and Railway"
echo ""
echo "🎉 Your app will be accessible from any device once deployed!"
