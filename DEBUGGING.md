# 🔧 Руководство по отладке

## Проблема: Аудио не воспроизводится

### Симптомы:
```javascript
Audio error: error { target: audio, isTrusted: true, ... }
```

### Причины и решения:

#### 1. ✅ Backend не авторизован в Navidrome
**Проверка:**
```bash
# Откройте логи backend, ищите ошибки подключения к Navidrome
```

**Решение:**
- Убедитесь что Navidrome запущен на http://localhost:4533
- Проверьте что учетные данные в Settings правильные
- Проверьте CORS в Navidrome:
  ```bash
  docker exec navidrome env | grep CORS
  # Должно быть: ND_CORS_ALLOWEDORIGINS=http://localhost:3000,http://localhost:8000
  ```

#### 2. ✅ Track ID некорректный
**Проверка:**
```javascript
// В DevTools Console проверьте что track имеет правильный ID
console.log(currentTrack.id);
```

**Решение:**
- Убедитесь что вы кликаете на альбом (не на псевдо-треки)
- Альбом должен загрузить реальные треки через API

#### 3. ✅ Нет разрешения на автоплей
**Решение:**
- Кликните на страницу перед началом воспроизведения
- Браузеры блокируют autoplay без user interaction

#### 4. ✅ CORS проблема
**Проверка:**
```bash
# DevTools → Network → посмотрите на stream запрос
# Если 403/CORS - проблема с Navidrome
```

**Решение:**
```bash
# Остановите Navidrome
docker stop navidrome

# Запустите с правильными CORS настройками
docker run -d \
  --name navidrome \
  -p 4533:4533 \
  -v ~/Music:/music \
  -v ~/navidrome-data:/data \
  -e ND_CORS_ALLOWEDORIGINS="http://localhost:3000,http://localhost:8000" \
  deluan/navidrome:latest
```

---

## Отладка пошагово

### Шаг 1: Проверить Navidrome
```bash
# Убедитесь что Navidrome запущен
curl http://localhost:4533/ping

# Должно вернуть OK
```

### Шаг 2: Проверить Backend
```bash
# Убедитесь что backend работает
curl http://localhost:8000/health

# Должно вернуть {"status":"ok"}
```

### Шаг 3: Проверить авторизацию
```bash
# В браузере откройте DevTools → Application → Cookies
# Должна быть кука: access_token_cookie
```

### Шаг 4: Тестовый запрос
```bash
# Получите ID любого трека из ответа API
curl http://localhost:8000/api/library/random?size=1

# Скопируйте "id" из ответа и проверьте stream
curl http://localhost:8000/api/stream/TRACK_ID -H "Cookie: access_token_cookie=YOUR_TOKEN" > test.mp3

# Если test.mp3 создался и проигрывается - backend работает
```

### Шаг 5: Проверить frontend
```javascript
// В DevTools Console
const audio = new Audio('/api/stream/TRACK_ID');
audio.play();

// Если играет - проблема в коде плеера
// Если не играет - проблема в backend/navidrome
```

---

## Частые ошибки

### ❌ 401 Unauthorized
**Причина:** Не авторизован или истек токен

**Решение:**
1. Выйти и войти снова
2. Проверить что куки сохраняются (не Incognito режим)

### ❌ 404 Not Found (stream)
**Причина:** Неправильный track ID

**Решение:**
1. Проверить что клик на альбом → загружает треки
2. Посмотреть Network tab в DevTools
3. Убедиться что `/api/library/albums/{albumId}` возвращает треки

### ❌ 403 Forbidden
**Причина:** CORS или backend не может подключиться к Navidrome

**Решение:**
1. Добавить CORS в Navidrome (см. выше)
2. Проверить что backend может достучаться до Navidrome:
   ```bash
   # Внутри backend venv
   python -c "import httpx; print(httpx.get('http://localhost:4533/ping').text)"
   ```

### ❌ ERR_ABORTED (Chrome)
**Причина:** Range requests не поддерживаются или токен истек во время загрузки

**Решение:**
1. Проверить что backend поддерживает Range requests
2. Проверить логи backend на ошибки

---

## Проверочный список

Перед тем как искать баги, убедитесь:

- [ ] Navidrome запущен и доступен (http://localhost:4533)
- [ ] В Navidrome есть музыка и она проиндексирована
- [ ] CORS настроен в Navidrome
- [ ] Backend запущен (http://localhost:8000)
- [ ] Frontend запущен (http://localhost:3000)
- [ ] Вы вошли в систему (есть куки)
- [ ] Вы кликаете на альбом (не на псевдо-треки HomePage)
- [ ] В DevTools Console нет красных ошибок
- [ ] В DevTools Network tab stream запрос возвращает 200 OK

---

## Логирование

### Backend логи
```python
# В app/routers/stream.py добавьте:
import logging
logger = logging.getLogger(__name__)

@router.get("/{track_id}")
async def stream_track(track_id: str, ...):
    logger.info(f"Streaming track: {track_id}")
    # ...
```

### Frontend логи
```typescript
// В playerStore.ts
setCurrentTrack: (track) => {
  console.log('Setting current track:', track);
  set({ currentTrack: track });
  audioService.setSrc(`/api/stream/${track.id}`);
},
```

### Аудио события
```typescript
// В useAudioEngine.ts
const handleError = (e: Event) => {
  console.error('Audio error details:', {
    error: e,
    src: audio.src,
    networkState: audio.networkState,
    readyState: audio.readyState,
    currentTrack: currentTrack
  });
  // ...
};
```

---

## Полезные команды

```bash
# Просмотр логов Navidrome
docker logs navidrome -f

# Просмотр логов Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --log-level debug

# Очистить куки в браузере
# DevTools → Application → Cookies → Delete All

# Пересоздать .env если потерялся
cd backend
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32)); print('ENCRYPTION_KEY=' + secrets.token_urlsafe(32))" > .env

# Проверить порты
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :4533  # Navidrome

# Убить процессы если порты заняты
lsof -ti:3000 | xargs kill -9
```

---

## Контакты для помощи

Если ничего не помогает:

1. **GitHub Issues** - создайте issue с:
   - Версией браузера
   - Логами backend
   - Логами frontend (DevTools Console)
   - Скриншотами Network tab

2. **Navidrome Discord** - для вопросов по Subsonic API

3. **Stack Overflow** - для общих вопросов по React/FastAPI

---

**Удачи в отладке! 🐛🔨**
