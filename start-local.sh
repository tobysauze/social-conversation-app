#!/bin/bash
# A robust script to start the local development environment.

# 1. Kill any lingering processes on the required ports
echo "--- Clearing ports 3000 and 5001 ---"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
sleep 1

# 2. Set the correct Node.js version for this script's execution context
echo "--- Setting Node.js version to 20 ---"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
nvm use 20 > /dev/null # Use Node 20, hide output

# 3. Start both servers using the main dev command
echo "--- Starting backend and frontend servers. This may take a moment. ---"
npm run dev


