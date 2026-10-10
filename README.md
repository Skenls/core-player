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
- **Поддержка любых форматов**: потоковое воспроизведение MP3, FLAC, Opus и Raw без потерь качества (с поддержкой HTTP Range 206 для мгновенной перемотки).
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
- **In-memory кэширование обложек**: полное отсутствие мерцания картинок при переходах между страницами и наведении курсора.
- **Аппаратное ускорение**: анимации карточек и текстов песен изолированы на отдельных GPU-слоях композитинга (`transform-gpu`, `will-change`).

### 👥 Безопасность и пользователи
- **Автономная база данных пользователей (SQLite)**: параметры подключения к серверу Navidrome изолированы в серверном `.env` файле. Пользователи входят по собственным логинам и паролям.
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

## 🚀 Быстрый старт

### Требования
- **Python 3.10+**
- **Node.js 18+** и **npm**
- Запущенный инстанс **Navidrome** (локально или в Docker)

---

### 1. Запуск Navidrome (Docker)

Если Navidrome еще не развернут, запустите его в Docker:

```bash
docker run -d \
  --name navidrome \
  --restart unless-stopped \
  -p 4533:4533 \
  -v ~/Music:/music:ro \
  -v ~/navidrome-data:/data \
  -e ND_CORS_ALLOWEDORIGINS="http://localhost:3000,http://localhost:8000" \
  deluan/navidrome:latest
```

> Откройте `http://localhost:4533` в браузере и создайте аккаунт администратора Navidrome.

---

### 2. Запуск через Docker Compose (Рекомендуется)

Все приложение (React фронтенд, FastAPI бэкенд и Nginx реверс-прокси) упаковано в единый production-контейнер:

```bash
# 1. Склонировать репозиторий
git clone https://github.com/Skenls/core-player.git
cd core-player

# 2. Создать файл окружения из примера
cp backend/.env.example backend/.env
# Отредактируйте backend/.env и укажите URL и данные вашего Navidrome

# 3. Запустить контейнер
docker compose up -d --build
```

Приложение будет доступно по адресу: **`http://localhost:3000`**

---

### 3. Локальная автоматическая установка (без Docker)

```bash
# Запустить скрипт быстрой настройки (создаст venv, установит зависимости и сгенерирует ключи)
chmod +x setup.sh start.sh check.sh
./setup.sh
```

После выполнения скрипта отредактируйте созданный файл `backend/.env` и укажите данные вашего Navidrome:

```env
NAVIDROME_URL=http://localhost:4533
NAVIDROME_USER=ваш_логин_navidrome
NAVIDROME_PASS=ваш_пароль_navidrome
```

Запустите оба сервиса одной командой:

```bash
./start.sh
```

Приложение будет доступно по адресу: **`http://localhost:3000`**

Дефолтные учетные данные администратора для входа в плеер:
- **Логин**: `admin`
- **Пароль**: `admin123` *(рекомендуется сменить после первого входа)*

---

### Ручной запуск (для разработки)

#### Запуск Backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Запуск Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Конфигурация `.env`

Все параметры сервера конфигурируются в файле `backend/.env`:

| Переменная | По умолчанию | Описание |
| :--- | :--- | :--- |
| `SECRET_KEY` | *(случайная строка)* | Секретный ключ для подписи JWT токенов |
| `ENCRYPTION_KEY` | *(Fernet ключ)* | Ключ шифрования конфиденциальных данных |
| `DATABASE_URL` | `sqlite+aiosqlite:///./navidrome_player.db` | Строка подключения к SQLite БД |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Разрешенные источники для CORS |
| `SESSION_EXPIRE_DAYS` | `30` | Срок жизни авторизационной сессии (дней) |
| `NAVIDROME_URL` | `http://localhost:4533` | Базовый URL сервера Navidrome |
| `NAVIDROME_USER` | `admin` | Имя пользователя Navidrome для прокси-запросов |
| `NAVIDROME_PASS` | `admin` | Пароль пользователя Navidrome |
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
- `GET /api/stream/{track_id}` — стриминг аудиодорожки с поддержкой Range 206 и параметра `?format=mp3|flac|opus|raw`.
- `GET /api/stream/cover/{cover_id}` — получение оптимизированной обложки альбома (`?size=300|600`).
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
| `Стрелка вправо` | Следующий трек |
| `Стрелка влево` | Предыдущий трек |
| `Стрелка вверх` | Увеличить громкость (+5%) |
| `Стрелка вниз` | Уменьшить громкость (-5%) |
| `Escape` | Свернуть полноэкранную карточку Now Playing |

---

## 📄 Лицензия

Проект распространяется под лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).

---

<div align="center">
  <b>Сделано с любовью к качественной музыке и плавному UI ❤️</b>
</div>
