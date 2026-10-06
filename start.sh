#!/bin/bash

echo "🎵 Core Player - Запуск с новыми функциями"
echo ""

# Check if backend is running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend уже запущен на порту 8000"
else
    echo "🚀 Запуск Backend..."
    cd backend
    source venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "✅ Backend запущен (PID: $BACKEND_PID)"
    cd ..
fi

echo ""

# Check if frontend is running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Frontend уже запущен на порту 3000"
else
    echo "🚀 Запуск Frontend..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    echo "✅ Frontend запущен (PID: $FRONTEND_PID)"
    cd ..
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Все сервисы запущены!"
echo ""
echo "📱 Откройте http://localhost:3000"
echo ""
echo "✨ Новые функции:"
echo "   • Настройки фона (динамический / кастомный)"
echo "   • Скрытие sidebar (кнопка со стрелкой)"
echo "   • Полноэкранный режим (клик на трек)"
echo "   • Синхронизированные тексты песен"
echo "   • Кнопки избранного (PlayerBar + NowPlaying)"
echo "   • Управление повтором (off/all/one)"
echo "   • Детальные страницы артистов и альбомов"
echo "   • Выбор аудио кодека (mp3/raw/opus/flac)"
echo ""
echo "⚙️  Откройте Настройки (иконка шестеренки) для:"
echo "   • Смены фона на кастомный"
echo "   • Выбора кодека воспроизведения"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Нажмите Ctrl+C для остановки всех сервисов"

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Остановка сервисов...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
