# Core Player Backend

FastAPI backend for Core Player - a modern music streaming interface for Navidrome.

## Features

- **Secure Authentication**: Session-based auth with encrypted credentials
- **Subsonic API Integration**: Full Navidrome/Subsonic protocol support
- **Audio Streaming**: HTTP Range request support for seamless seeking
- **Lyrics Aggregation**: Automatic lyrics fetching from Navidrome + LRCLIB fallback
- **Album Art Proxy**: Cached cover art delivery

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `SECRET_KEY`: Random secret for session signing
- `ENCRYPTION_KEY`: Fernet key for credential encryption (generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)

### 3. Run Server

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with Navidrome credentials
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Library
- `GET /api/library/albums` - List albums
- `GET /api/library/albums/{id}` - Get album details
- `GET /api/library/artists` - List artists
- `GET /api/library/playlists` - List playlists
- `GET /api/library/search?query=...` - Search tracks/albums/artists

### Streaming
- `GET /api/stream/{track_id}` - Stream audio (Range request supported)
- `GET /api/stream/cover/{cover_id}` - Get album art

### Lyrics
- `GET /api/lyrics/{track_id}?artist=...&title=...` - Get synced lyrics

## Docker Support

```bash
docker build -t core-player-backend .
docker run -p 8000:8000 -v $(pwd)/.env:/app/.env core-player-backend
```
