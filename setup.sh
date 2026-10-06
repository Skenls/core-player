#!/bin/bash

# Core Player - Complete Setup Script
# This script sets up both backend and frontend

set -e

echo "🎵 Core Player - Complete Setup"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Navidrome is running
echo -e "${BLUE}Checking Navidrome...${NC}"
if curl -s http://localhost:4533 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Navidrome is running on port 4533${NC}"
else
    echo -e "${YELLOW}⚠ Navidrome не обнаружен на localhost:4533${NC}"
    echo "  Убедитесь, что Navidrome запущен перед использованием"
fi
echo ""

# Backend Setup
echo -e "${BLUE}Setting up Backend...${NC}"
cd backend

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Setup .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    # Generate encryption key
    ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
    
    # Update .env with generated keys
    sed -i.bak "s|your-secret-key-here-change-in-production|$SECRET_KEY|g" .env
    sed -i.bak "s|your-fernet-encryption-key-here|$ENCRYPTION_KEY|g" .env
    rm .env.bak
    
    echo -e "${GREEN}✓ .env file created with generated keys${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

cd ..
echo -e "${GREEN}✓ Backend setup complete${NC}"
echo ""

# Frontend Setup
echo -e "${BLUE}Setting up Frontend...${NC}"
cd frontend

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
else
    echo -e "${GREEN}✓ Node modules already installed${NC}"
fi

cd ..
echo -e "${GREEN}✓ Frontend setup complete${NC}"
echo ""

# Final instructions
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}To start the application:${NC}"
echo ""
echo "1. Start Backend (in terminal 1):"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   uvicorn app.main:app --reload"
echo ""
echo "2. Start Frontend (in terminal 2):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:3000"
echo ""
echo -e "${YELLOW}Default Navidrome credentials (update in .env):${NC}"
echo "   URL: http://localhost:4533"
echo "   User: skenls"
echo "   Pass: test"
echo ""
echo -e "${GREEN}Enjoy your music! 🎵${NC}"
