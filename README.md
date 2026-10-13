# 🎵 Core Music Player

<div align="center">

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-black?style=for-the-badge&logo=framer&logoColor=blue)
![Navidrome](https://img.shields.io/badge/Navidrome-Subsonic-00B4D8?style=for-the-badge)

**Современный, производительный и визуально утонченный веб-плеер для персонального сервера Navidrome с эстетикой Apple Music и macOS Glassmorphism.**

[Возможности](#-возможности) • [Быстрый старт](#-быстрый-старт) • [Архитектура](#-архитектура-и-стек) • [Конфигурация .env](#-конфигурация-env) • [API](#-api-эндпоинты)

</div>

---

## ✨ Возможности

### 🎧 Стриминг и аудио
- **Высокопроизводительный Zero-Copy стриминг (`X-Accel-Redirect`)**: стриминг аудиопотоков (включая тяжелые lossless FLAC 24-bit) напрямую через Nginx без проксирования чанков через Python event loop. Нулевая нагрузка на CPU сервера и мгновенная перемотка.
- **Поддержка любых форматов**: потоковое воспроизведение MP3, FLAC, Opus и Raw без потерь качества (с полной поддержкой HTTP Range 206 Partial Content).
- **Переключение кодеков на лету**: выбор желаемого кодека транскодирования в настройках плеера (MP3, Opus, FLAC, Raw).
- **Полноценное управление очередью**: бесконечный плейлист, перемешивание (Shuffle), повтор трека или всего списка (Repeat Off / All / One).
- **Интеграция с MediaSession API**: системные клавиши на клавиатуре, медиа-кнопки наушников и экран блокировки ОС синхронизированы с плеером.

### 🎤 Синхронизированная лирика (Караоке)
- **Умная интеграция с LRCLIB & Navidrome**: построчный синхронизированный текст песен с миллисекундными таймкодами.
- **Нормализация метаданных**: умный алгоритм очистки исполнителей и названий от авторов/композиторов (ФИО после разделителей `•`, `·`, `|`, фиты), позволяющий находить слова для 100% треков из стриминговых сервисов.
- **Плавный кинематографичный автоскролл**: активная строчка мягко удерживается на экране, с возможностью ручной прокрутки и мгновенного возврата по кнопке «Синхронизировать».

### 🎨 Кастомизация и дизайн
- **Glassmorphism UI**: полупрозрачные многослойные панели с мягким размытием заднего плана в стиле macOS Sequoia.
- **Динамический фон**: автоматическая генерация фонового градиента из обложки текущего трека с точной настройкой силы размытия (Blur) и затемнения (Dim).
- **Пользовательский фон (Custom Wallpaper)**: загрузка собственных обоев любого разрешения файлом с компьютера (до 25 МБ) прямо на сервер либо по ссылке.
- **Режим чистого минимализма**: кнопка быстрого отключения фонового изображения в полноэкранной карточке (Sparkles toggle) для любителей строгого темного стиля.

### ⚡ Производительность и оптимизация (60–120 FPS)
- **Устранение двойного GPU-блюра**: автоматическое отключение тяжелого размытия основного интерфейса при открытии полноэкранной карточки (экономит до 50% ресурсов видеокарты).
- **Безупречно плавный скроллинг**: отказ от ресурсоемкого `backdrop-filter` внутри элементов бесконечных сеток в пользу оптимизированного полупрозрачного стекла.
- **Дисковое кэширование обложек в Nginx**: 30-дневный кэш обложек на диске Nginx (`proxy_cache`) с мгновенной отдачей и in-memory кэшем на клиенте.
- **Аппаратное ускорение**: анимации карточек и текстов песен изолированы на отдельных GPU-слоях композитинга (`transform-gpu`, `will-change`).

### 👥 Безопасность и пользователи
- **Автономная база данных пользователей (SQLite)**: параметры подключения к серверу Navidrome изолированы в серверном `.env` файле. Пользователи входят по собственным логинам и паролям.
- **Защита медиапотоков**: эндпоинты `/api/stream/{track_id}` и обложек защищены сессионной авторизацией с валидацией сессии за 0.3 мс.
- **Ролевая модель (Admin / User)**: администраторы могут создавать новых пользователей и назначать им права прямо во вкладке настроек «Пользователи».
- **Защищенные JWT-сессии**: аутентификация через безопасные `httpOnly` Cookies с защитой от XSS.

---

## 🛠 Архитектура и стек

```
webplayer/
├── backend/                  # FastAPI сервер (Python 3.12+ / 3.14)
│   ├── app/
│   │   ├── routers/          # auth, admin, library, stream, lyrics
│   │   ├── config.py         # Настройки окружения (Pydantic Settings)
│   │   ├── database.py       # Асинхронная база данных (SQLAlchemy + aiosqlite)
│   │   ├── lyrics.py         # Парсинг LRC и клиент к LRCLIB API
│   │   ├── models.py         # Модели пользователей, сессий, избранного, плейлистов
│   │   ├── subsonic_client.py# Клиент Subsonic/OpenSubsonic API
│   │   └── main.py           # Инициализация FastAPI и CORS
│   ├── data/                 # Директория пользовательских фонов и аватаров
│   ├── .env.example          # Шаблон переменных окружения
│   └── requirements.txt      # Python зависимости
│
├── frontend/                 # Клиентское приложение (React 19 + Vite)
│   ├── src/
│   │   ├── api/              # Axios-клиент и методы API
│   │   ├── components/       # UI компоненты (PlayerBar, NowPlayingView, LyricsView, etc.)
│   │   ├── hooks/            # useAudioEngine, useLibrary, useFavorites, useLyricsSync
│   │   ├── store/            # Zustand стейт (плеер, UI настройки, сессия)
│   │   ├── views/            # Страницы (Home, Tracks, Albums, Artists, Playlists, Favorites)
│   │   ├── App.tsx           # Корневой контейнер
│   │   └── main.tsx          # Точка входа React
│   ├── tailwind.config.ts    # Конфигурация дизайн-системы Tailwind
│   └── package.json
│
├── setup.sh                  # Скрипт первоначальной автоматической настройки
├── start.sh                  # Скрипт запуска всех сервисов одной командой
└── check.sh                  # Скрипт проверки статуса работы сервисов
```

---

## 🚀 Развертывание и быстрый старт

### 🐳 Развертывание в Docker на сервере (с нуля)

Все приложение (React фронтенд, FastAPI бэкенд и высокопроизводительный Nginx реверс-прокси с акселерацией `X-Accel-Redirect`) собрано в единый production-образ.

#### 1. Клонирование репозитория
```bash
git clone https://github.com/Skenls/core-player.git
cd core-player
```

#### 2. Создание файла конфигурации
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

---

### 🌐 Выбор режима работы (`NAVIDROME_NETWORK_MODE`)

В файле `backend/.env` задается режим подключения к вашему серверу Navidrome:

```env
NAVIDROME_NETWORK_MODE=local  # или 'wg'
```

#### 🔹 Режим `local` (Navidrome и Core Player на одном сервере или в общей локальной сети)
**Когда выбирать:**
- Navidrome и Core Player запущены на одной и той же машине/сервере.
- Navidrome находится в той же физической локальной сети (например, домашний NAS).

**Настройка в `backend/.env`:**
- Если Navidrome запущен в Docker или как сервис на хост-машине:
  ```env
  NAVIDROME_NETWORK_MODE=local
  NAVIDROME_URL=http://host.docker.internal:4533
  ```
  *(контейнер Core Player автоматически связывается с хостом через `host-gateway`)*
- Если Navidrome на отдельном сервере в локальной сети:
  ```env
  NAVIDROME_NETWORK_MODE=local
  NAVIDROME_URL=http://192.168.1.100:4533
  ```

---

#### 🔹 Режим `wg` (Подключение через WireGuard VPN)
**Когда выбирать:**
- Core Player развернут на удаленном сервере (VPS), а ваша музыкальная библиотека Navidrome находится дома (за провайдерским NAT / серым IP).
- Требуется безопасный зашифрованный канал без необходимости "светить" порт Navidrome во внешний интернет.

**Пошаговая настройка WireGuard клиента на сервере:**
1. Установите WireGuard на сервер с Core Player:
   ```bash
   sudo apt update && sudo apt install -y wireguard
   ```
2. Скопируйте файл конфигурации клиента (например, `wg0.conf`), полученный от вашего WireGuard-сервера в локальной сети Navidrome, в директорию `/etc/wireguard/`:
   ```bash
   sudo nano /etc/wireguard/wg0.conf
   ```
3. Поднимите туннель и включите автозапуск:
   ```bash
   sudo systemctl enable --now wg-quick@wg0
   ```
4. Проверьте соединение и доступность Navidrome по его VPN-адресу:
   ```bash
   ping 10.8.0.2
   curl -I http://10.8.0.2:4533/rest/ping.view
   ```
5. Укажите параметры в `backend/.env`:
   ```env
   NAVIDROME_NETWORK_MODE=wg
   NAVIDROME_URL=http://10.8.0.2:4533
   NAVIDROME_USER=ваш_логин_navidrome
   NAVIDROME_PASS=ваш_пароль_navidrome
   ```

---

#### 3. Запуск контейнера Core Player
```bash
docker compose up -d --build
```

Сервис готов к работе и слушает порт `3000`. Вы можете открывать плеер напрямую по `http://<IP-сервера>:3000`.

Дефолтные учетные данные начального администратора:
- **Логин**: `admin`
- **Пароль**: `admin123` *(смените пароль после первого входа)*

---

### 💻 Локальный запуск без Docker (для разработки)

#### 1. Автоматическая настройка:
```bash
chmod +x setup.sh start.sh check.sh
./setup.sh
```
Отредактируйте `backend/.env` и запустите сервисы:
```bash
./start.sh
```

#### 2. Ручной запуск:
```bash
# Терминал 1 (Бэкенд):
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Терминал 2 (Фронтенд):
cd frontend
npm install
npm run dev
```

---

## ⚙️ Конфигурация `.env`

Все параметры сервера конфигурируются в файле `backend/.env`:

| Переменная | По умолчанию | Описание |
| :--- | :--- | :--- |
| `NAVIDROME_NETWORK_MODE` | `local` | Режим сети: `local` (хост / локальная сеть) или `wg` (WireGuard VPN) |
| `NAVIDROME_URL` | `http://localhost:4533` | Базовый URL сервера Navidrome (`http://host.docker.internal:4533` в Docker) |
| `NAVIDROME_USER` | `skenls` | Имя пользователя Navidrome для прокси-запросов |
| `NAVIDROME_PASS` | `admin` | Пароль пользователя Navidrome |
| `SECRET_KEY` | *(генерируется)* | Секретный ключ для подписи сессионных токенов |
| `ENCRYPTION_KEY` | *(Fernet ключ)* | Ключ шифрования конфиденциальных данных |
| `DATABASE_URL` | `sqlite+aiosqlite:///...` | Строка подключения к SQLite БД |
| `CORS_ORIGINS` | `http://localhost:3000` | Разрешенные источники для CORS (через запятую) |
| `SESSION_EXPIRE_DAYS` | `30` | Срок жизни авторизационной сессии (дней) |
| `INITIAL_ADMIN_USERNAME` | `admin` | Логин начального администратора Core Player |
| `INITIAL_ADMIN_PASSWORD` | `admin123` | Пароль начального администратора Core Player |

---

## 🔌 API Эндпоинты

### Аутентификация и пользователи
- `POST /api/auth/login` — вход по логину и паролю (устанавливает httpOnly cookie).
- `GET /api/auth/me` — получение данных текущего авторизованного пользователя.
- `POST /api/auth/logout` — завершение сессии.
- `GET /api/admin/users` — список пользователей (только для `admin`).
- `POST /api/admin/users` — создание нового пользователя с назначением роли (`admin` / `user`).
- `DELETE /api/admin/users/{user_id}` — удаление пользователя.

### Стриминг и медиа
- `GET /api/stream/{track_id}` — защищенный стриминг аудиодорожки (авторизация по cookie или `?session_id=...`) с поддержкой Range 206, акселерацией Nginx `X-Accel-Redirect` и параметра `?format=mp3|flac|opus|raw`.
- `GET /api/stream/cover/{cover_id}` — защищенное получение оптимизированной обложки альбома (`?size=300|600`) с 30-дневным дисковым кэшированием Nginx.
- `POST /api/stream/custom-background` — загрузка пользовательского фонового изображения на сервер (multipart/form-data).
- `GET /api/stream/custom-background` — отдача сохраненного пользовательского фона с HTTP-кэшированием.

### Музыкальная библиотека (Subsonic прокси)
- `GET /api/library/albums` — получение альбомов (`?type=newest|alphabeticalByName|random|recent`).
- `GET /api/library/albums/{album_id}` — информация об альбоме со списком треков.
- `GET /api/library/artists` — список артистов библиотеки.
- `GET /api/library/artists/{artist_id}` — дискография артиста.
- `GET /api/library/random` — подборка случайных треков.
- `GET /api/library/search` — глобальный поиск по трекам, альбомам и артистам.
- `GET /api/library/favorites/ids` — список ID треков и альбомов в избранном.
- `POST /api/library/favorites/toggle` — добавить/удалить трек или альбом из избранного.
- `GET /api/library/playlists` — список пользовательских плейлистов.
- `POST /api/library/playlists` — создание нового плейлиста.
- `POST /api/library/playlists/{playlist_id}/tracks` — добавление трека в плейлист.

### Лирика
- `GET /api/lyrics/{track_id}` — получение синхронизированных слов песни (LRCLIB API + OpenSubsonic fallback с поддержкой таймкодов).

---

## ⌨️ Горячие клавиши

| Клавиша | Действие |
| :--- | :--- |
| `Пробел` | Воспроизведение / Пауза |
| `Стрелка вправо` | Перемотка вперед (+5 сек) |
| `Стрелка влево` | Перемотка назад (-5 сек) |
| `F` | Открыть / закрыть полноэкранный плеер Now Playing |
| `Escape` | Свернуть карточку Now Playing или модальное окно |

---

## 📄 Лицензия

Проект распространяется под лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).

---

<div align="center">
  <b>Сделано с любовью к качественной музыке и плавному UI ❤️</b>
</div>
