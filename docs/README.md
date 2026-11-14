# Core Music Player — Technical Documentation

Welcome to the comprehensive technical documentation for **Core Music Player**, a modern, high-performance web-based audio streaming client and reverse proxy designed for [Navidrome](https://www.navidrome.org/) (Subsonic API). The player features an Apple Music & macOS-inspired Glassmorphism aesthetic, sub-millisecond zero-copy streaming, synchronized karaoke lyrics via LRCLIB, and a dual-mode audio seek engine.

---

## 📚 Documentation Index

The documentation is organized into modular guides covering every layer of the application:

1. **[System Architecture & Design (`ARCHITECTURE.md`)](file:///Users/skenls/webplayer/docs/ARCHITECTURE.md)**
   - High-level system topology and container runtime layout.
   - High-performance Zero-Copy streaming via Nginx `X-Accel-Redirect`.
   - Streaming pipeline & dual seek models (HTTP Range 206 vs Server Time Offsets).
   - Caching strategies (Nginx disk cache, in-memory LRCLIB cache, React Query client cache).
   - Security architecture, authentication lifecycle, and cryptographic tokens.
   - End-to-end request lifecycle and sequence diagrams.

2. **[Backend Engine & API Reference (`BACKEND.md`)](file:///Users/skenls/webplayer/docs/BACKEND.md)**
   - FastAPI application structure, async lifespan, and dependencies.
   - Subsonic API Client implementation and authentication protocol (`u`, `t`, `s`, `v`, `c`).
   - Audio streaming and wallpaper upload handlers.
   - Metadata cleansing engine: legal name (FIO) detection and artist split filtering.
   - Synchronized lyrics engine with LRCLIB multi-candidate heuristics and dual-TTL caching.
   - SQLite persistence layer with SQLAlchemy Async ORM (Users, Sessions, Favorites, Playlists).
   - Complete REST API reference with query parameters, request bodies, response models, and key function calls.

3. **[Frontend Architecture & Audio Engine (`FRONTEND.md`)](file:///Users/skenls/webplayer/docs/FRONTEND.md)**
   - React 19, TypeScript, Vite, and Tailwind CSS design architecture.
   - Global state management with Zustand (`playerStore`, `uiStore`, `sessionStore`).
   - Audio Engine (`audioService`) & dual-mode seek engine (`streamSeek`).
   - Core React hooks (`useAudioEngine`, `useLyricsSync`, `useFavorites`, `useLibrary`, `useKeyboardShortcuts`).
   - Component hierarchy, layout shell, dynamic background canvas generator, and views.
   - Complete guide to key frontend calls, methods, parameters, and user interaction flows.

---

## 🚀 Quick Repository Structure

```tree
webplayer/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── admin.py        # User & role administration endpoints
│   │   │   ├── auth.py         # Authentication & session endpoints
│   │   │   ├── library.py      # Subsonic proxy, metadata filters, favorites, playlists
│   │   │   ├── lyrics.py       # Synced lyrics lookup router
│   │   │   └── stream.py       # Audio streaming & cover art delivery (X-Accel-Redirect)
│   │   ├── auth.py             # Passlib bcrypt hashing, Fernet ciphers, session tokens
│   │   ├── config.py           # Pydantic v2 application settings from .env
│   │   ├── database.py         # Async SQLAlchemy engine & session factory
│   │   ├── dependencies.py     # FastAPI Depends providers (user auth, Subsonic client)
│   │   ├── lyrics.py           # LRCLIB API client, heuristics & memory cache
│   │   ├── main.py             # FastAPI entrypoint, CORS, DB bootstrap, routers
│   │   ├── models.py           # SQLAlchemy ORM models (User, Session, Favorite, Playlist)
│   │   ├── stream_params.py    # Query parameter builder for Navidrome stream requests
│   │   └── subsonic_client.py  # Async Subsonic HTTP client with response unwrapping
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API client modules (auth, library, lyrics, admin)
│   │   ├── components/
│   │   │   ├── background/     # Dynamic canvas background & custom wallpapers
│   │   │   ├── layout/         # AppShell, Sidebar navigation
│   │   │   ├── library/        # AlbumGrid, AlbumCard, TrackCard
│   │   │   ├── modals/         # SettingsModal, AddToPlaylistModal
│   │   │   ├── nowplaying/     # NowPlayingView modal, LyricsView synchronized display
│   │   │   └── player/         # Bottom PlayerBar with progress, controls & volume
│   │   ├── hooks/              # Custom hooks (audio engine, lyrics sync, shortcuts)
│   │   ├── lib/                # AudioService singleton, streamSeek logic, formatters
│   │   ├── store/              # Zustand state stores (player, UI, session)
│   │   ├── types/              # Subsonic & player TypeScript interfaces
│   │   ├── views/              # Pages (Home, Tracks, Albums, Artists, Favorites, Playlists)
│   │   ├── App.tsx             # Root React component
│   │   └── main.tsx            # DOM root & React Query provider
│   └── package.json
├── docker/
│   ├── nginx.conf              # Nginx reverse proxy, disk caching, X-Accel-Redirect
│   └── entrypoint.sh           # Container initialization script
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Docker Compose deployment definition
└── docs/                       # Technical documentation
```

---

## 🛠️ Technology Stack Summary

| Layer | Technologies |
| :--- | :--- |
| **Edge Proxy** | [Nginx](https://nginx.org/) with `sendfile`, `tcp_nopush`, `proxy_cache`, `X-Accel-Redirect`, Rate Limiting |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/) (ASGI), Python 3.11+ |
| **Backend Database** | [SQLite](https://www.sqlite.org/) via [SQLAlchemy 2.0 (Async)](https://docs.sqlalchemy.org/) & [aiosqlite](https://github.com/omnilib/aiosqlite) |
| **HTTP Clients** | [HTTPX](https://www.python-httpx.org/) (async connection pooling) |
| **Security & Auth** | Passlib (bcrypt), Cryptography (Fernet symmetric encryption), HttpOnly cookies |
| **External APIs** | [Navidrome / Subsonic API v1.16.1](https://opensubsonic.netlify.app/), [LRCLIB](https://lrclib.net/) |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/), Glassmorphism, CSS Backdrop Filters, Lucide React Icons |
| **State & Data Fetching**| [Zustand](https://github.com/pmndrs/zustand) (with local storage persistence), [TanStack Query v5](https://tanstack.com/query) |
| **Audio Playback** | Native HTML5 Audio (`HTMLAudioElement`), MediaSession API, Dual-Mode Seek Engine |
