# 🎵 Core Player - Быстрый старт

## 🚀 Автоматическая установка (Рекомендуется)

```bash
./setup.sh
```

Скрипт автоматически:
- ✅ Создаст виртуальное окружение Python
- ✅ Установит все зависимости
- ✅ Сгенерирует ключи шифрования
- ✅ Настроит .env файлы

## 🎯 Запуск приложения

### Терминал 1 - Backend
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

Backend будет доступен на: **http://localhost:8000**

### Терминал 2 - Frontend
```bash
cd frontend
npm run dev
```

Frontend будет доступен на: **http://localhost:3000**

## 🔐 Первый вход

1. Откройте http://localhost:3000
2. Введите данные вашего Navidrome:
   - **URL**: `http://localhost:4533` (или ваш URL)
   - **Username**: ваш логин
   - **Password**: ваш пароль
3. Нажмите "Войти"

## ✅ Что готово

### Backend (100%)
- ✅ FastAPI сервер
- ✅ Session-based аутентификация (httpOnly cookies)
- ✅ Subsonic API proxy с автоматическим unwrap
- ✅ HTTP Range requests для seeking
- ✅ Lyrics aggregation (Navidrome + LRCLIB)
- ✅ Async streaming с httpx
- ✅ Encrypted credentials в SQLite

### Frontend Core (100%)
- ✅ React + Vite + TypeScript
- ✅ Zustand stores (player, session, ui)
- ✅ Audio Engine с MediaSession API
- ✅ React Query для data fetching
- ✅ API client с типизацией
- ✅ Lyrics sync hook

### UI Components (100%)
- ✅ Sidebar с animated active pill
- ✅ TrackCard с hover animations
- ✅ AlbumGrid со stagger animations
- ✅ PlayerBar с Range seeking
- ✅ NowPlayingView с размытым фоном
- ✅ LyricsView с синхронизацией и автоскроллом
- ✅ LoginPage
- ✅ AppShell

## 📁 Структура проекта

```
navidrome-player/
├── backend/              ✅ Полностью готов
│   ├── app/
│   │   ├── routers/     # API endpoints
│   │   ├── main.py      # FastAPI app
│   │   ├── auth.py      # Аутентификация
│   │   ├── subsonic_client.py
│   │   └── lyrics.py
│   └── requirements.txt
│
├── frontend/             ✅ Полностью готов
│   ├── src/
│   │   ├── components/  # React компоненты
│   │   ├── store/       # Zustand stores
│   │   ├── hooks/       # Custom hooks
│   │   ├── api/         # API client
│   │   └── views/       # Pages
│   └── package.json
│
├── setup.sh             # Автоматическая установка
└── README.md
```

## 🎨 Основные функции

### Воспроизведение
- ▶️ Play/Pause с анимацией иконки
- ⏭️ Next/Previous треки
- 🔀 Shuffle режим
- 🔁 Repeat (off/all/one)
- 🔊 Управление громкостью
- ⏩ Seeking с Range requests (без перезагрузки)

### UI
- 🎭 Glassmorphism дизайн
- ✨ Framer Motion анимации
- 🌈 Ambient glow от обложек
- 📱 MediaSession API (системные медиа-контролы)
- 🎤 Синхронизированные lyrics (караоке)
- 🖼️ Полноэкранный Now Playing режим

### Данные
- 🔐 Безопасная аутентификация
- 💾 Encrypted credentials
- 🎵 Subsonic API integration
- 📝 Автоматический поиск lyrics
- 🚀 React Query caching

## 🔧 Дополнительные команды

### Backend
```bash
# Создать encryption key вручную
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Запуск с другим портом
uvicorn app.main:app --port 8001

# Production mode
uvicorn app.main:app --host 0.0.0.0 --workers 4
```

### Frontend
```bash
# Build для production
npm run build

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

## 🐛 Troubleshooting

### Backend не запускается
```bash
# Проверить Python версию (нужен 3.10+)
python --version

# Переустановить зависимости
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend не запускается
```bash
# Очистить кеш и переустановить
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Navidrome не подключается
- Проверьте, что Navidrome запущен: `curl http://localhost:4533`
- Проверьте URL в форме входа
- Проверьте логин/пароль
- Проверьте CORS настройки в backend/.env

### Seeking не работает
- Убедитесь, что backend проксирует Range заголовки
- Проверьте консоль браузера на ошибки
- Проверьте, что Navidrome поддерживает Range requests

## 📊 API Endpoints

### Auth
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь
- `POST /api/auth/logout` - Выход

### Library
- `GET /api/library/albums` - Список альбомов
- `GET /api/library/artists` - Список артистов
- `GET /api/library/search?query=...` - Поиск

### Streaming
- `GET /api/stream/{track_id}` - Аудио поток
- `GET /api/stream/cover/{id}` - Обложка

### Lyrics
- `GET /api/lyrics/{track_id}` - Тексты песен

## 🎯 Следующие шаги (опционально)

Приложение полностью функционально! Дополнительные возможности для расширения:

- [ ] Drag-and-drop для очереди
- [ ] Поддержка плейлистов
- [ ] Настройки (Settings modal)
- [ ] PWA режим
- [ ] Кроссфейд между треками
- [ ] Эквалайзер
- [ ] Поиск по библиотеке

## 🤝 Поддержка

Если возникли проблемы:
1. Проверьте логи backend в терминале
2. Откройте DevTools в браузере (F12)
3. Убедитесь, что Navidrome запущен
4. Проверьте .env файлы

## 📄 Лицензия

MIT

---

**Статус: ✅ Готово к использованию!**

Запустите `./setup.sh` и начните слушать музыку! 🎵
