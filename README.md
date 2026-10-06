# Core Music Player 🎵

Стильный веб-плеер для Navidrome с кинематографичными анимациями в стиле macOS/Apple Music.

![Screenshot](helpers/main-screen.png)

## ✨ Особенности

- 🎨 **Glassmorphism UI** - полупрозрачные элементы с backdrop blur
- 🌊 **Динамический фон** - размытая обложка альбома с анимацией "дыхания"
- 🎬 **Плавные анимации** - Spring physics переходы (framer-motion)
- 📱 **Полностью адаптивный** - работает на всех устройствах
- 🎵 **Все функции плеера** - очередь, shuffle, repeat, громкость, перемотка
- 🔍 **Умная навигация** - альбомы, артисты, треки, плейлисты, избранное
- 🎼 **MediaSession API** - управление через системные медиа-кнопки
- 🔐 **Безопасная авторизация** - JWT токены + httpOnly cookies

## 🛠 Технологический стек

### Frontend
- **React 19** + **TypeScript**
- **Vite** - быстрая сборка
- **Tailwind CSS** - utility-first стили
- **Framer Motion** - кинематографичные анимации
- **Zustand** - легковесное управление состоянием
- **TanStack Query** - умное кеширование данных
- **Lucide React** - красивые иконки

### Backend
- **FastAPI** (Python 3.14) - async API
- **SQLAlchemy** - ORM для базы данных
- **Pydantic** - валидация данных
- **JWT** - безопасная аутентификация
- **Subsonic API** - интеграция с Navidrome

## 🚀 Быстрый старт

### 1. Запуск Navidrome (Docker)

```bash
docker run -d \
  --name navidrome \
  -p 4533:4533 \
  -v ~/Music:/music \
  -v ~/navidrome-data:/data \
  -e ND_CORS_ALLOWEDORIGINS="http://localhost:3000,http://localhost:8000" \
  deluan/navidrome:latest
```

Откройте http://localhost:4533 и создайте админа.

### 2. Backend

```bash
cd backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Уже создан .env файл с ключами
# SECRET_KEY и ENCRYPTION_KEY сгенерированы автоматически

# Запустить сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен на http://localhost:8000

### 3. Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev сервер
npm run dev
```

Frontend будет доступен на http://localhost:3000

## 📱 Использование

1. Откройте http://localhost:3000
2. Войдите используя учетные данные Navidrome
3. Наслаждайтесь музыкой! 🎶

### Управление

- **Клик на альбом** - загрузить треки и начать воспроизведение
- **Клик на трек** - воспроизвести трек
- **Клик на мини-плеер** - открыть полноэкранный Now Playing
- **Пробел** - пауза/воспроизведение
- **MediaSession API** - управление через системные кнопки

## 📁 Структура проекта

```
webplayer/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # Аутентификация
│   │   │   ├── library.py       # Библиотека (альбомы, артисты, треки)
│   │   │   └── stream.py        # Стриминг аудио и обложек
│   │   ├── config.py            # Настройки приложения
│   │   ├── database.py          # SQLAlchemy конфигурация
│   │   ├── main.py              # FastAPI приложение
│   │   └── subsonic_client.py   # Клиент для Subsonic API
│   ├── .env                     # Переменные окружения
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/                 # API клиенты
    │   │   ├── client.ts
    │   │   ├── auth.ts
    │   │   ├── library.ts
    │   │   └── index.ts
    │   ├── components/
    │   │   ├── background/      # DynamicBackground
    │   │   ├── layout/          # Sidebar, AppShell
    │   │   ├── library/         # AlbumGrid, TrackCard
    │   │   ├── nowplaying/      # NowPlayingView, LyricsView
    │   │   └── player/          # PlayerBar, Controls
    │   ├── hooks/               # React хуки
    │   │   ├── useAudioEngine.ts
    │   │   └── useLibrary.ts
    │   ├── lib/                 # Утилиты
    │   │   ├── audioService.ts
    │   │   └── queryClient.ts
    │   ├── store/               # Zustand stores
    │   │   ├── playerStore.ts
    │   │   ├── sessionStore.ts
    │   │   └── uiStore.ts
    │   ├── types/               # TypeScript типы
    │   ├── views/               # Страницы
    │   │   ├── HomePage.tsx
    │   │   ├── FavoritesPage.tsx
    │   │   ├── TracksPage.tsx
    │   │   ├── ArtistsPage.tsx
    │   │   ├── AlbumsPage.tsx
    │   │   ├── PlaylistsPage.tsx
    │   │   └── LoginPage.tsx
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

## 🎨 Дизайн-система

### Цвета
- **Фон**: 5-слойная градация от #05070C до #1E2636
- **Стекло**: полупрозрачный белый (bg-white/5...bg-white/20)
- **Текст**: белый с opacity 30%/50%/70%/100%
- **Акценты**: динамические, извлекаются из обложки

### Компоненты
- **Скругление**: 999px для кнопок, 50% для аватаров
- **Размытие**: backdrop-blur-xl (24px), backdrop-blur-2xl (48px)
- **Тени**: мягкие, многослойные
- **Переходы**: spring physics (stiffness: 400, damping: 30)

### Типографика
- Fluid scale через clamp()
- Custom properties для семейств шрифтов
- Tight tracking на заголовках, generous на body

## 🔧 API Endpoints

### Backend REST API

```
POST   /api/auth/login         - Войти
GET    /api/auth/me            - Получить текущего пользователя
POST   /api/auth/logout        - Выйти

GET    /api/library/albums     - Список альбомов
GET    /api/library/albums/:id - Альбом с треками
GET    /api/library/artists    - Список артистов
GET    /api/library/artists/:id - Артист с альбомами
GET    /api/library/playlists  - Список плейлистов
GET    /api/library/random     - Случайные треки
GET    /api/library/search     - Поиск

GET    /api/stream/:id         - Стриминг аудио (с Range support)
GET    /api/stream/cover/:id   - Обложка альбома

POST   /api/library/star       - Добавить в избранное
POST   /api/library/unstar     - Убрать из избранного
POST   /api/library/scrobble   - Отметить как прослушанное
```

## ✅ Реализованные фичи

- [x] Аутентификация через Navidrome
- [x] Просмотр библиотеки (альбомы, артисты, треки, плейлисты)
- [x] Воспроизведение аудио с поддержкой Range requests
- [x] Очередь воспроизведения
- [x] Shuffle и Repeat режимы
- [x] Динамический фон из обложки
- [x] Плавные анимации переходов
- [x] MediaSession API
- [x] Адаптивный дизайн
- [x] Все вкладки (Главная, Избранное, Треки, Артисты, Альбомы, Плейлисты)

## 🚧 В разработке

- [ ] Синхронизированные тексты песен (LRC)
- [ ] Живой поиск
- [ ] Визуализация аудио
- [ ] Keyboard shortcuts
- [ ] Offline mode (Service Worker)
- [ ] Детальные страницы артистов/альбомов
- [ ] Создание и редактирование плейлистов

## 🐛 Известные проблемы

### Аудио не воспроизводится?
1. Убедитесь что Navidrome запущен на http://localhost:4533
2. Проверьте что в библиотеке есть музыка
3. Проверьте CORS настройки Navidrome:
   ```bash
   ND_CORS_ALLOWEDORIGINS="http://localhost:3000,http://localhost:8000"
   ```
4. Проверьте что вы авторизованы (куки должны быть сохранены)

### Debug
```bash
# Проверить авторизацию
curl http://localhost:8000/api/auth/me -b cookies.txt

# Проверить stream endpoint
curl http://localhost:8000/api/stream/{TRACK_ID} -b cookies.txt > test.mp3
```

## 📝 Changelog

### v1.0.0 (текущая версия)
- ✅ Полный UI в стиле Apple Music
- ✅ Динамический фон с анимацией
- ✅ Все основные страницы (6 вкладок)
- ✅ Backend API с аутентификацией
- ✅ Интеграция с Navidrome через Subsonic API
- ✅ Плавные анимации (framer-motion)
- ✅ Адаптивный дизайн

## 🤝 Contributing

Проект создан для личного использования. Pull requests приветствуются!

## 📄 License

MIT License - используйте как хотите!

## 💡 Благодарности

- **Navidrome** - отличный self-hosted музыкальный сервер
- **Apple Music** - вдохновение для дизайна
- **Framer Motion** - за потрясающие анимации

---

**Сделано с ❤️ и кофе ☕**
