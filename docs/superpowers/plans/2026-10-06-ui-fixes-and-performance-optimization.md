# UI Fixes & Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bottom scrubber alignment and colors, eliminate cover image blinking on page entry and hover, fix empty Albums tab, implement reliable custom background in NowPlayingView, and perform serious GPU/rendering optimization for 60-120fps smoothness.

**Architecture:** 
- Unified scrubber styles and fixed CSS transform centering in PlayerBar.
- TanStack Query staleTime caching + non-resetting image cache in TrackCard + hardware composite layers.
- Subsonic album listing type correction (`newest` / `alphabeticalByName`) with UI sort filter.
- Server-side custom wallpaper upload endpoint (`/api/stream/custom-background`) bypassing localStorage 5MB quotas.
- GPU fill-rate optimization: conditional unmount/pause of background blur when fullscreen modal is active, elimination of per-card backdrop-filter in grids.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, TanStack Query, FastAPI, SQLAlchemy, Subsonic API.

---

### Task 1: Scrubber alignment and styling in bottom PlayerBar

**Files:**
- Modify: `frontend/src/components/player/PlayerBar.tsx`

- [ ] **Step 1: Update scrubber colors and thumb dot vertical centering**
  Replace conflicting Framer Motion translation on the thumb dot with CSS translate classes and update bar track/fill colors to match `NowPlayingView`.
- [ ] **Step 2: Verify in browser / build**
  Run: `cd frontend && npm run build`
- [ ] **Step 3: Commit**
  Run: `git add frontend/src/components/player/PlayerBar.tsx && git commit -m "fix(player): center scrubber thumb and match bar styling with track card"`

---

### Task 2: Fix cover image flickering on page entry and hover

**Files:**
- Modify: `frontend/src/hooks/useLibrary.ts`
- Modify: `frontend/src/components/library/TrackCard.tsx`
- Modify: `frontend/src/components/library/AlbumGrid.tsx`

- [ ] **Step 1: Configure staleTime and gcTime for library queries**
  In `frontend/src/hooks/useLibrary.ts`, set `staleTime: 5 * 60 * 1000` for `useRandomTracks`, `useAlbums`, and `useArtists`.
- [ ] **Step 2: Prevent opacity:0 reset on cached images in TrackCard**
  In `frontend/src/components/library/TrackCard.tsx`, eliminate initial opacity flash for cached images. Remove `backdrop-blur-sm` from the card hover overlay. Replace conflicting Framer Motion springs with hardware-accelerated CSS transforms.
- [ ] **Step 3: Verify build**
  Run: `cd frontend && npm run build`
- [ ] **Step 4: Commit**
  Run: `git add frontend/src/hooks/useLibrary.ts frontend/src/components/library/TrackCard.tsx frontend/src/components/library/AlbumGrid.tsx && git commit -m "perf(covers): eliminate image reload flicker on page entry and hover"`

---

### Task 3: Fix empty Albums tab and add album sorting

**Files:**
- Modify: `backend/app/routers/library.py`
- Modify: `frontend/src/views/AlbumsPage.tsx`

- [ ] **Step 1: Update backend get_albums route to support alphabeticalByName**
  In `backend/app/routers/library.py`, add `alphabeticalByName` to `get_albums` type literal.
- [ ] **Step 2: Update AlbumsPage to default to newest and add sort controls**
  In `frontend/src/views/AlbumsPage.tsx`, default to `newest` and add a sort bar (Новые, По алфавиту, Случайные, Недавно прослушанные).
- [ ] **Step 3: Test backend route with curl**
  Run: `curl -s "http://127.0.0.1:8000/api/library/albums?type=newest"`
- [ ] **Step 4: Commit**
  Run: `git add backend/app/routers/library.py frontend/src/views/AlbumsPage.tsx && git commit -m "fix(albums): display all library albums and add sort options"`

---

### Task 4: Custom background upload endpoint & NowPlayingView background fix

**Files:**
- Modify: `backend/app/routers/stream.py`
- Modify: `frontend/src/components/modals/SettingsModal.tsx`
- Modify: `frontend/src/components/nowplaying/NowPlayingView.tsx`

- [ ] **Step 1: Implement custom background endpoints on backend**
  In `backend/app/routers/stream.py`, add `POST /custom-background` and `GET /custom-background`.
- [ ] **Step 2: Update SettingsModal to upload background files to backend**
  In `frontend/src/components/modals/SettingsModal.tsx`, upload images via `FormData` to `/api/stream/custom-background`.
- [ ] **Step 3: Fix NowPlayingView background rendering and fallbacks**
  In `frontend/src/components/nowplaying/NowPlayingView.tsx`, ensure `customBackgroundUrl` is used when `backgroundMode === 'custom'`, with robust fallbacks and `onError` recovery.
- [ ] **Step 4: Verify build and test upload**
  Run: `cd frontend && npm run build`
- [ ] **Step 5: Commit**
  Run: `git add backend/app/routers/stream.py frontend/src/components/modals/SettingsModal.tsx frontend/src/components/nowplaying/NowPlayingView.tsx && git commit -m "feat(background): support server-side custom wallpaper upload and fix card background"`

---

### Task 5: Comprehensive performance & animation optimization

**Files:**
- Modify: `frontend/src/components/background/DynamicBackground.tsx`
- Modify: `frontend/src/components/library/TrackCard.tsx`
- Modify: `frontend/src/components/library/AlbumGrid.tsx`
- Modify: `frontend/src/components/nowplaying/NowPlayingView.tsx`

- [ ] **Step 1: Disable main DynamicBackground when NowPlayingView is open**
  Eliminate dual 4K/1080p blur passes on the GPU by hiding `DynamicBackground` while `isNowPlayingOpen` is true.
- [ ] **Step 2: Remove backdrop-filter from 100-card grids**
  Replace per-card `backdrop-blur-sm` in `TrackCard` with high-performance semi-transparent solid colors.
- [ ] **Step 3: Add transform-gpu and will-change layers**
  Ensure hardware acceleration layers on animated modals and cards.
- [ ] **Step 4: Verify build and test performance**
  Run: `cd frontend && npm run build`
- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/background/DynamicBackground.tsx frontend/src/components/library/TrackCard.tsx frontend/src/components/library/AlbumGrid.tsx frontend/src/components/nowplaying/NowPlayingView.tsx && git commit -m "perf: optimize GPU blur passes, card grid scrolling, and animation smoothness"`
