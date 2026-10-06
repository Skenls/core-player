#!/bin/bash

# Core Player - Проверка статуса
# Этот скрипт проверяет, что все сервисы работают корректно

echo "🔍 Проверка Core Player..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Backend
echo "Проверка Backend (http://localhost:8000)..."
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Backend работает${NC}"
else
    echo -e "${RED}❌ Backend не отвечает${NC}"
    echo "   Запустите: cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
fi
echo ""

# Check Frontend
echo "Проверка Frontend (http://localhost:3000)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo -e "${GREEN}✅ Frontend работает${NC}"
else
    echo -e "${RED}❌ Frontend не отвечает${NC}"
    echo "   Запустите: cd frontend && npm run dev"
fi
echo ""

# Check Navidrome
echo "Проверка Navidrome (http://localhost:4533)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4533 | grep -q "200"; then
    echo -e "${GREEN}✅ Navidrome работает${NC}"
else
    echo -e "${YELLOW}⚠️  Navidrome не обнаружен${NC}"
    echo "   Убедитесь, что Navidrome запущен на порту 4533"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Все проверки завершены!${NC}"
echo ""
echo "🎵 Откройте http://localhost:3000 для входа"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
