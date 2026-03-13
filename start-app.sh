#!/bin/bash

# Innerwork App Launcher
# This script starts the Innerwork app

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the app directory
cd "$SCRIPT_DIR"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    echo "🔄 Stopping any existing processes on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Check and kill existing processes
echo "🚀 Starting Innerwork..."
echo "📋 Checking for existing processes..."

if check_port 3000; then
    echo "⚠️  Port 3000 (frontend) is in use"
    kill_port 3000
fi

if check_port 5001; then
    echo "⚠️  Port 5001 (backend) is in use"
    kill_port 5001
fi

# Wait a moment for ports to be released
sleep 3

# Start the application
echo "🎯 Launching Innerwork..."
echo "📱 Frontend will be available at: http://localhost:3000"
echo "🔧 Backend will be available at: http://localhost:5001"
echo ""
echo "💡 Login credentials:"
echo "   Username: Toby"
echo "   Password: Amazon12308"
echo ""
echo "⏳ Starting servers... (this may take a moment)"
echo ""

# Start the app
npm run dev

# Keep the terminal open to show logs
echo ""
echo "🛑 App stopped. Press any key to close this window..."
read -n 1 -s








