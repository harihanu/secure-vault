#!/bin/bash

# Secure Vault - Quick Setup Script for Mac/Linux
# Usage: ./start-vault.sh or bash start-vault.sh

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           SECURE VAULT - QUICK SETUP                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
echo -e "${BOLD}[1/4] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo ""
    echo -e "${RED}  ERROR: Node.js is not installed!${NC}"
    echo ""
    echo "  Please install Node.js from: https://nodejs.org"
    echo "  Download the LTS version and run this script again."
    echo ""
    echo "  Or use a package manager:"
    echo "    Mac:   brew install node"
    echo "    Linux: sudo apt install nodejs npm"
    echo ""
    exit 1
fi
echo -e "      Node.js found: ${GREEN}$(node --version)${NC}"
echo ""

# Check if npm is available
echo -e "${BOLD}[2/4] Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo ""
    echo -e "${RED}  ERROR: npm is not available!${NC}"
    echo ""
    echo "  Please reinstall Node.js from: https://nodejs.org"
    echo ""
    exit 1
fi
echo -e "      npm found: ${GREEN}$(npm --version)${NC}"
echo ""

# Install live-server if not present
echo -e "${BOLD}[3/4] Checking live-server...${NC}"
if ! command -v live-server &> /dev/null; then
    echo "      Installing live-server..."
    npm install -g live-server
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}  ERROR: Failed to install live-server!${NC}"
        echo "  Try running with sudo: sudo npm install -g live-server"
        echo ""
        exit 1
    fi
    echo -e "      live-server installed successfully!"
else
    echo -e "      live-server found!"
fi
echo ""

# Start the server
echo -e "${BOLD}[4/4] Starting Secure Vault server...${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  SERVER STARTING...                                     ║${NC}"
echo -e "${GREEN}║                                                         ║${NC}"
echo -e "${GREEN}║  Open your browser to:                                  ║${NC}"
echo -e "${GREEN}║  ${BOLD}http://localhost:2134${NC}${GREEN}                                  ║${NC}"
echo -e "${GREEN}║                                                         ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop the server                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Try to open browser (Mac/Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:2134
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:2134 2>/dev/null || echo "  Open http://localhost:2134 in your browser"
fi

live-server --port=2134
