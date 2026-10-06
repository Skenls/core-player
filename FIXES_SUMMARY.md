# Исправления Core Music Player

## Что было исправлено:

### 1. ✅ Frontend - PostCSS конфигурация
- Исправлен `postcss.config.js` для ES модулей (был CommonJS формат)
- Удален несуществующий класс `border-border` из index.css
- Обновлены все пакеты до последних версий

### 2. ✅ Backend - Зависимости
- Добавлен недостающий пакет `greenlet` в requirements.txt
- Создан `.env` файл с необходимыми ключами:
  - `SECRET_KEY` (для JWT токенов)
  - `ENCRYPTION_KEY` (для шифрования паролей Navidrome)

### 3. ✅ Динамический фон
- Создан компонент `DynamicBackground.tsx`
- Размытая обложка текущего трека как фон
- Плавная анимация "дыхания" (масштабирование 20s loop)
- Градиентные оверлеи и эффект виньетки
- Интегрирован в `App.tsx`

### 4. ✅ Все вкладки реализованы
Созданы компоненты для всех разделов:

- **HomePage** - Недавние альбомы + случайные треки
- **FavoritesPage** - Избранные альбомы (starred)
- **TracksPage** - Случайные 100 треков
- **ArtistsPage** - Все артисты с алфавитным фильтром
- **AlbumsPage** - Все альбомы
- **PlaylistsPage** - Все плейлисты

### 5. ✅ Исправлена сетка медиатеки
- `AlbumGrid` теперь поддерживает 2 типа: `track` и `album`
- При клике на альбом загружаются его треки и начинается воспроизведение
- При клике на трек - играет напрямую
- Правильная типизация для Track и Album

## Известные проблемы (требуют внимания):

### 🔴 Аудио не воспроизводится
**Причина**: Stream URL `/api/stream/${track.id}` требует аутентификации

**Что нужно проверить**:
1. Navidrome запущен и доступен на `http://localhost:4533`
2. В Navidrome есть музыка и она проиндексирована
3. Backend может подключиться к Navidrome (проверить логи)
4. Пользователь успешно авторизован (куки сохранены)

**Для отладки**:
```bash
# Проверить авторизацию
curl -b cookies.txt http://localhost:8000/api/auth/me

# Проверить stream endpoint
curl -b cookies.txt http://localhost:8000/api/stream/{TRACK_ID} > test.mp3
```

### 🟡 CORS (если Navidrome на другом порту/хосте)
Если Navidrome не на localhost:4533, нужно:
1. В Navidrome добавить переменную окружения:
   ```
   ND_CORS_ALLOWEDORIGINS=http://localhost:3000,http://localhost:8000
   ```
2. Перезапустить Navidrome

## Как запустить:

### Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend:
```bash
cd frontend
npm run dev
```

### Navidrome (Docker):
```bash
docker run -d \
  --name navidrome \
  -p 4533:4533 \
  -v /path/to/music:/music \
  -v /path/to/data:/data \
  -e ND_CORS_ALLOWEDORIGINS="http://localhost:3000,http://localhost:8000" \
  deluan/navidrome:latest
```

## Следующие шаги:

1. **Отладка аудио**: 
   - Проверить авторизацию backend → navidrome
   - Проверить что треки существуют в библиотеке
   - Проверить логи backend при попытке воспроизведения

2. **Тексты песен (Lyrics)**:
   - Реализовать парсинг LRC файлов
   - Добавить синхронизацию с воспроизведением
   - Реализовать перемотку по клику на строчку

3. **Поиск**:
   - Добавить поле поиска в header
   - Реализовать живой поиск через Subsonic API

4. **Дополнительные фичи**:
   - Кеширование обложек
   - Оффлайн режим (Service Worker)
   - Keyboard shortcuts
   - Визуализация аудио

## Структура проекта:

```
webplayer/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── library.py
│   │   │   └── stream.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── subsonic_client.py
│   ├── .env
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/           # API клиенты
    │   ├── components/
    │   │   ├── background/      # DynamicBackground
    │   │   ├── layout/          # Sidebar, AppShell
    │   │   ├── library/         # AlbumGrid, TrackCard
    │   │   ├── nowplaying/      # LyricsView
    │   │   └── player/          # PlayerBar, Controls
    │   ├── hooks/         # useLibrary, useAudioEngine
    │   ├── store/         # Zustand stores
    │   ├── types/         # TypeScript types
    │   ├── views/         # Page components
    │   └── App.tsx
    └── package.json
```

## Контрольный список:

- [x] PostCSS config исправлен
- [x] Backend зависимости установлены
- [x] .env файл создан
- [x] Динамический фон реализован
- [x] Все вкладки созданы
- [x] AlbumGrid поддерживает альбомы и треки
- [ ] Аудио воспроизведение работает
- [ ] Тексты песен (Lyrics) работают
- [ ] Поиск реализован
