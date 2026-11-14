# Synapse — recommendation system plan

## What the current player gives us

- Backend: FastAPI + async SQLAlchemy + SQLite, WAL already enabled, tables created with `create_all` (no Alembic).
- Music source: Navidrome through Subsonic/OpenSubsonic. `search3` is already used with an empty query and pagination, so the whole catalog can be indexed from it.
- Favorites: stored locally per app user; track and album favorites exist. Artist favorites can be derived from those.
- Player: Zustand queue with `currentTrack`, `currentTime`, `duration`, `nextTrack`, and `setQueue`. There is no playback telemetry today.
- Home is section-based; adding Synapse at the top fits the existing pattern.
- You chose Synapse-only learning: normal album/playlist listening will not train the profile. Favorites still act as explicit anchors.

---

## 1. Product behavior

### Home page

Add a **Synapse** section at the very top of Home, before existing sections and hidden while searching.

Contents:

- Filter chips, multi-select:
  - **Familiar**
  - **Unfamiliar**
  - **Favorites**
- Mood chips below them, single-select:
  - **Sad**
  - **Productive**
  - **Upbeat**
  - Clicking the active mood clears it.
- Defaults: Familiar + Unfamiliar selected, Favorites off, no mood.
- A refresh button and a “Play all” action.
- Up to 20 tracks, with:
  - cover, title, artist, duration
  - one short reason: “Because you like X”, “From a favorite album”, “New artist near Y”, “Fits Sad”, etc.
  - play button per track.
- Starting a track creates the Synapse queue; only tracks from this queue are marked as Synapse tracks for learning.
- If the catalog is still syncing, show a compact “Synapse is learning your library” state. If favorites exist, show a favorites-only fallback mix; otherwise show the sync state.

### Filter semantics

- **Familiar**: tracks by artists with positive Synapse history or favorite-anchor status.
- **Unfamiliar**: tracks by artists with no positive Synapse history and no favorite relationship.
- **Favorites**: the user’s favorited tracks and tracks from favorited albums. If Familiar is also selected, other tracks by those favorite artists/albums are included too. Favorites alone does not silently expand to unfamiliar artists.
- If Favorites alone has fewer tracks than requested, return what exists and show “Add Familiar to expand the mix”. No filler from arbitrary artists.
- If only Unfamiliar is selected, all candidates come from unfamiliar artists, ranked by content similarity and bridge-artist links.
- If both Familiar and Unfamiliar are selected, start at roughly 75/25 familiar/unfamiliar and adapt the ratio from completion vs skip rates. Range: 10–45% unfamiliar.
- **Mood** only re-ranks/filters; it never changes the Familiar/Unfamiliar selection. It is a soft filter, so the mix never becomes empty just because mood data is sparse.

### Continue Playback

Add a setting in Settings → Playback:

- **Continue playback** — default off.
- When enabled, if an album, playlist, or track queue reaches its end, Synapse fetches another 15 tracks and appends them automatically.
- Appended tracks are marked as Synapse tracks and therefore train the profile.
- Uses the last-used Synapse filters; if Synapse was never used, uses the defaults.
- Shows a small toast: “Synapse added 15 tracks”.
- No auto-continue if offline, if the catalog is unavailable, or if the user changed to a new queue while the request was in flight.
- Repeat-one and repeat-all keep their current behavior; auto-continue only fires on a real queue end.

### Profile reset

Add a “Reset Synapse” action in Settings. It deletes learned taste, events, cooldowns, moods, and sessions for the current user, but keeps favorites. This is useful for correcting a badly skewed profile.

---

## 2. Database design

New tables only. No destructive changes to existing tables.

### Catalog tables

| Table | Purpose | Main columns |
|---|---|---|
| `catalog_tracks` | Local searchable snapshot of the library | `id` (Navidrome song id), `title`, `artist_name`, `primary_artist_id`, `album_id`, `album_name`, `cover_art`, `duration`, `year`, `release_date`, `raw_genre`, `raw_genres` JSON, `raw_moods` JSON, `bpm`, `added_at`, `is_active`, `last_seen_at` |
| `catalog_artists` | Canonical artist identities | `id`, `name`, `normalized_name`, `navidrome_id` nullable, `is_synthetic` |
| `catalog_albums` | Album metadata for affinity and cooldowns | `id`, `name`, `artist_id`, `artist_name`, `year`, `last_seen_at` |
| `catalog_track_artists` | Multi-artist graph, including featured artists | `track_id`, `artist_id`, `role` (`primary`/`featured`/`album`), `position`, `weight` |
| `catalog_artist_edges` | Precomputed collaboration graph for discovery | `artist_id`, `related_artist_id`, `co_track_count`, `weight` |
| `catalog_genre_families` | Broad families such as Rock, Electronic, Hip-Hop | `id`, `slug`, `display_name` |
| `catalog_genres` | Canonical genres | `id`, `slug`, `display_name`, `family_id`, `is_unknown` |
| `catalog_genre_aliases` | Raw tag → canonical genre mapping, EN/RU/abbreviations | `alias`, `genre_id`, `confidence`, `source` (`seed`/`fuzzy`), `updated_at` |
| `catalog_track_genres` | Multi-genre membership | `track_id`, `genre_id`, `raw_tag`, `weight` |
| `catalog_meta` | Sync status and versions | `key`, `value`, `updated_at` |

Indexes: active tracks by year, tracks by album, track-artists by artist, track-genres by genre, artist edges in both directions.

### User-profile tables

| Table | Purpose | Main columns |
|---|---|---|
| `user_taste` | Learned affinity per entity | `user_id`, `entity_type` (`track`/`artist`/`album`/`genre`/`family`/`era`), `entity_id`, `score`, `confidence`, `exposures`, `updated_at` |
| `user_track_state` | Play/skip statistics and fatigue | `user_id`, `track_id`, `plays`, `completions`, `skips`, `last_played_at`, `last_skipped_at`, `avg_completion` |
| `user_mood_taste` | Mood-specific track/genre/artist affinity | `user_id`, `mood`, `entity_type`, `entity_id`, `score`, `observations`, `updated_at` |
| `user_cooldowns` | Temporary artist/album/track bans | `user_id`, `entity_type`, `entity_id`, `until`, `severity`, `reason`, `source_mix_id` |
| `user_recommendation_state` | Per-user online model state | `user_id`, `feature_weights` JSON, `bias`, `exploration_ratio`, `familiar_ratio`, `model_version`, `total_events`, `updated_at` |

### Synapse tables

| Table | Purpose | Main columns |
|---|---|---|
| `synapse_sessions` | One generated mix | `id`, `user_id`, `filters` JSON, `mood`, `created_at`, `last_refill_at`, `status` |
| `synapse_session_tracks` | Every track exposed to the user | `session_id`, `position`, `track_id`, `channel`, `reason`, `score`, `features` JSON, `exposed_at` |
| `listening_events` | Raw Synapse feedback log | `id` (client UUID), `user_id`, `session_id`, `track_id`, `primary_artist_id`, `album_id`, `genre_ids` JSON, `event_type`, `position_seconds`, `duration_seconds`, `percent`, `mood`, `context` JSON, `client_ts`, `received_at` |

`listening_events.id` is unique, so retries are idempotent. `features` is stored with each exposure so model updates use exactly the features that produced the recommendation, not recomputed ones.

---

## 3. Catalog sync and metadata normalization

### Sync

- Run once at startup if the catalog is empty or older than 6 hours, then periodically every 6 hours.
- Use `search3` with an empty query, batches of 500, and song offsets.
- Upsert by song ID; mark tracks `is_active = false` only if they were not seen in a completed sync.
- Build artist edges after each sync.
- Store progress/status in `catalog_meta`.
- Run as an in-process `asyncio` task from FastAPI lifespan. No Celery/Redis.
- WAL is already enabled; use one sync writer and short transactions.
- For 100k tracks this is roughly 200 requests; run sequentially with a small concurrency cap and surface progress.

### Artists

- Prefer OpenSubsonic `artists` array: all credited artists with IDs.
- Fallback: `artistId` + `artist`, plus `displayArtist`.
- Fallback for multi-artist strings: reuse/extract the existing `split_artist_names` helper.
- Primary artist weight 1.0; featured artists 0.5–0.7 depending on position.
- Resolve names through `normalized_name`; create a synthetic local artist only when Navidrome gives no usable ID.
- Build `catalog_artist_edges` so an unfamiliar artist can be suggested through a collaboration with a known artist.

### Year

- Use `originalDate` year first, then `releaseDate`, then `year`.
- Validate 1900–current year + 1; otherwise store null.
- Store both exact year and era/decade. Era affinity uses the decade; scoring also uses distance from the user’s preferred years.

### Genres

Use OpenSubsonic `genres` when present; otherwise split `genre` on `;`, `,`, `|`, and `/` only after trying the whole tag as an alias. This protects compounds like “Drum & Bass” and “R&B”.

Normalization pipeline:

1. Unicode NFKC, casefold.
2. `ё` → `е`, `&` → `and`, collapse punctuation/whitespace.
3. Normalize common abbreviations before lookup: `d&b`/`dnb` → `drum and bass`, `rnb`/`r&b` → `rnb`, `hh` → `hip hop`, `edm`, `idm`, `lofi`, etc.
4. Exact alias lookup in `catalog_genre_aliases`.
5. If the whole tag misses, split compounds and repeat.
6. Fuzzy match against known canonical genres with `difflib`, threshold ~0.88, only within the same script. Fuzzy matches are stored with lower confidence.
7. If still unknown, create a canonical genre row with `is_unknown = true` and family inferred by keyword rules, otherwise family `other`.

Seed alias file: `backend/app/data/genre_aliases.json`, covering roughly 200–300 common EN/RU tags and abbreviations. Examples:

- `rock`, `рок`, `alternative`, `альтернатива`, `indie`, `инди`
- `hip hop`, `hip-hop`, `хип-хоп`, `rap`, `рэп`, `trap`, `трэп`
- `electronic`, `электроника`, `house`, `хаус`, `techno`, `техно`, `trance`, `транс`
- `dnb`, `d&b`, `drum and bass`, `драм-н-бейс`
- `rnb`, `r&b`, `r’n’b`, `ритм-н-блюз`
- `jazz`, `джаз`, `classical`, `классика`, `folk`, `фолк`, `metal`, `метал`
- `lo-fi`, `lofi`, `idm`, `ambient`, `эмбиент`, `soundtrack`, `саундтрек`
- `shanson`, `шансон`, `chanson`

If the alias version changes, re-resolve stored raw tags from `catalog_tracks.raw_genres`.

Unknown genres are preserved and still learnable. They are not silently dropped.

---

## 4. Recommendation algorithm

### 4.1 Taste profile

The profile is intentionally multi-cluster, not a single averaged taste vector. That is the key requirement for an eclectic listener.

Per user, maintain time-decayed affinity scores for:

- tracks
- artists (including featured artists, lower weight)
- albums
- genres
- genre families
- eras/decades

Each score has:

- `score` — positive or negative affinity
- `confidence` — grows with evidence, so one play does not dominate
- `exposures` — used for exploration bonuses

Favorites are not folded into this learned score. They are a separate, stable anchor set read directly from the `favorites` table at mix time. That makes favorite/unfavorite behavior exact and avoids decay/reversal bugs.

### 4.2 Candidate pools

For each selected filter, build candidates from separate channels:

- **Favorites**: exact favorited tracks; tracks from favorited albums.
- **Favorite artist**: other tracks by favorite artists, if Familiar is selected.
- **Artist affinity**: tracks by artists with positive Synapse history.
- **Album affinity**: other tracks from albums the user responded to.
- **Genre/family affinity**: tracks in preferred genres and genre families.
- **Era affinity**: tracks near preferred release years.
- **Bridge artist**: tracks by unfamiliar artist B where B collaborates with known artist A. This directly implements “suggest an artist the user doesn’t know yet, if available in the library.”
- **New arrivals**: recently added tracks matching the selected pools.
- **Wildcard**: stratified random sample within the selected pools, to prevent tunnel vision.

Exclude:

- inactive tracks
- tracks in `user_cooldowns` that have not expired
- tracks already exposed in this session
- recently played tracks (last 30–50, or 24h, whichever is larger)
- exact favorited tracks unless Favorites is selected
- tracks already in the active queue, when refilling

Cap candidates at roughly 1,500. If too few remain, relax recently-played first, then cooldowns, but never break the Familiar/Unfamiliar filter.

### 4.3 Features and scoring

Initial prior weights, later learned per user:

| Feature | Prior weight |
|---|---:|
| exact favorite track | +2.5 |
| favorite album | +1.5 |
| favorite artist | +2.0 |
| artist affinity | +1.6 |
| album affinity | +1.0 |
| genre affinity | +1.4 |
| family affinity | +0.8 |
| era affinity | +0.5 |
| year proximity | +0.4 |
| bridge-artist link | +0.9 |
| mood match | +1.2 |
| artist completion rate | +0.6 |
| unfamiliar artist exploration | +0.2 |
| novelty/UCB bonus | +0.5 |
| recent fatigue | -1.5 |
| same artist recently used | -0.8 |
| same album recently used | -0.5 |
| bias | -1.0 |

Raw score:

`p = sigmoid(bias + Σ weight_i × feature_i)`

Then:

- add UCB exploration bonus for rarely exposed artists
- apply mood boost if a mood is selected
- apply diversity penalty during selection

Affinity features are squashed with `tanh` so a very large favorite history cannot completely dominate. Confidence multiplies affinity features.

### 4.4 Selection for eclectic listeners

Do not just take the top 20 by score. That collapses eclectic taste into whichever cluster is strongest.

Instead:

1. Identify the user’s top 3–5 active genre/family clusters.
2. Allocate most slots proportionally across those clusters.
3. Guarantee at least 2 slots per active cluster when enough candidates exist.
4. Reserve 10–45% of slots for unfamiliar/exploration, depending on the selected filters and learned adaptation.
5. Greedy MMR-style selection:
   - same artist similarity 1.0
   - same album 0.8
   - same family 0.5
   - same era 0.2
   - penalty `0.25 × max similarity to already selected tracks`
6. Hard caps, scaled to queue size:
   - max 2 tracks per artist per 20
   - max 2 per album per 20
   - max 5 per family per 20
   - caps relax only when the selected pools cannot fill the queue.

This is what makes the system work for someone who listens to metal, baroque, and drum & bass in the same week: separate cluster affinities are preserved, and every mix is forced to represent several of them.

### 4.5 Online learning

When a Synapse track ends or is skipped, the backend builds a label:

- **Positive**: ended, or played ≥85%, or favorited while in Synapse.
- **Negative**: strong early skip.
- **Neutral/partial**: skipped after a meaningful portion; update taste slightly, but do not train the ranking model.

Only strong labels train the per-user logistic model:

`w_i += learning_rate × (label - p) × feature_i - L2 × w_i`

- learning rate starts around 0.03 and decays slowly
- L2 around 0.001
- weights clamped to a safe range
- bias updated the same way
- stored features from the exposure are used, not recomputed features

This means the model learns which signals actually predict your behavior. For example, if you consistently complete “new artist near a favorite” tracks, that feature’s weight rises. If you skip them, it falls.

### 4.6 Exploration adaptation

When both Familiar and Unfamiliar are selected:

- start at about 75/25 familiar/unfamiliar
- track completion rate separately for each pool
- if unfamiliar completions are higher, increase the unfamiliar share by ~2% per decision
- if unfamiliar skips dominate, decrease it
- clamp to 10–45%

If only one pool is selected, the ratio is fixed to that pool.

Use a UCB bonus per artist to avoid recommending the same small set of artists repeatedly:

`bonus = 0.5 × sqrt(log(total_exposures + 1) / (artist_exposures + 1))`

### 4.7 Skip cooldowns

Strong early skip definition:

- played less than `min(20 seconds, 25% of duration)` and not ended.

Weak skip:

- played less than `min(60 seconds, 50% of duration)` and not ended.

Neutral skip:

- anything later; no cooldown, little or no negative signal.

On a strong early skip from a Synapse track:

1. Determine whether the artist is “normally liked”:
   - artist is in favorite anchors, or
   - artist affinity has enough confidence and is in the user’s top quartile, or
   - artist completion rate ≥60% over at least 3 plays.
2. If the artist is normally liked:
   - cooldown the **album** for 3 days
   - cooldown the **track** for 3 days
   - do **not** cooldown the artist
3. Otherwise:
   - cooldown the **artist** for 3 days
   - cooldown the **album** for 7 days
   - cooldown the **track** for 14 days
4. Repeated early skips from the same artist:
   - 2 different tracks within 7 days → artist cooldown 7 days
   - 3 or more → artist cooldown 14 days
   - this overrides the “liked artist” exception

No genre-level hard cooldown. Genre affinity already receives a small negative update, but hard genre bans would punish an eclectic listener for one bad track.

A weak skip applies a smaller negative taste update but does not create a cooldown.

### 4.8 Mood learning

Mood is single-select: Sad, Productive, Upbeat. Clicking the active mood clears it.

Initial mood prior per track:

- OpenSubsonic `moods` tags if Navidrome provides them
- genre/family mapping from `backend/app/data/mood_priors.json`
- a weak BPM adjustment if `bpm` exists
- neutral 0.5 if there is no information

Behavioral learning:

- While a mood is active, each Synapse completion/favorite increases that track’s mood score and its genres/family’s mood score.
- An early skip decreases them.
- `user_mood_taste` stores these separately per mood, so a track can be good for “Productive” but not for “Sad”.
- To protect favorite artists from mood mismatch, an early skip in a mood-filtered session applies full negative weight to the mood profile but only half negative weight to the general artist/track taste.
- If the mood pool is sparse, relax the mood threshold and rank by the best available mood scores. The mix still fills.

This is behavioral mood inference, not acoustic analysis. It learns from your skips and completions, exactly as requested.

### 4.9 Cold start

- No catalog: show learning/sync state; optional favorites-only fallback.
- Catalog but no Synapse history: use favorites as anchors; if there are no favorites, build a stratified exploration mix across genre families and eras.
- Favorites but no Synapse history: strong anchor mix with some unfamiliar artists around favorite genres/years.
- After the first few events, the online model starts overriding the priors.

Consequence of the Synapse-only choice: a user who listens mostly to albums and never uses Synapse will stay close to their favorites/cold-start behavior. Familiarity will not be inferred from normal album plays. This is predictable, but worth knowing.

---

## 5. Event tracking

Only tracks carrying Synapse metadata produce learning events. Tracks started from albums, artists, playlists, or search do not.

Frontend `useSynapseTelemetry` mounted once in `AppShell`:

- On Synapse track start: send `start` with session ID, track ID, position 0.
- On track change, stop, or queue end: finalize previous play with:
  - `complete` if ended or ≥85%
  - `skip` with `skip_kind` strong/weak/neutral otherwise
  - actual played seconds and percent
- On page hide/`pagehide`: flush pending events with `navigator.sendBeacon` (same-origin cookies work).
- Batch events every ~10 seconds and on finalization.
- Keep a small client-side queue in memory/localStorage; retry failed batches.
- Client-generated UUIDs make every event idempotent.

Server processing is one transaction per batch:

1. Ignore duplicate event IDs.
2. Validate the track belongs to the catalog and the session belongs to the user.
3. Update `user_track_state`.
4. Apply positive/negative signals to `user_taste` across track, primary artist, featured artists, album, genres, family, and era.
5. Apply cooldown rules for strong skips.
6. Update mood scores if the event has a mood.
7. Train the per-user feature weights using the stored exposure features.
8. Increment exposure counters for artists/genres selected in the mix.

Signal weights, before decay:

- complete: +1.0 track, +0.7 artist, +0.4 album, +0.5 genre, +0.3 family, +0.2 era
- favorite track: handled separately as a stable anchor
- strong skip: -1.5 track, -0.6 artist, -0.8 album, -0.2 genre, -0.1 family
- weak skip: half of strong skip
- neutral skip: no taste update

Half-lives:

- plays/completions: 60 days
- skips: 21 days
- favorites anchors: no decay while favorited
- mood scores: 45 days
- artist/genre affinities: 90 days

Scores are decayed lazily when read or updated, not with a nightly full-table rewrite.

---

## 6. API endpoints

All endpoints require the existing authenticated user and always scope by `user_id`.

| Endpoint | Purpose |
|---|---|
| `GET /api/synapse/mix?familiarity=familiar,unfamiliar,favorites&mood=sad&limit=20` | Create a new mix. Returns tracks with `synapse` metadata and reasons. |
| `POST /api/synapse/sessions/{session_id}/refill` | Append more tracks; body includes `limit` and `exclude_track_ids`. Used by Play all/auto-continue. |
| `POST /api/synapse/events` | Batch playback telemetry. Returns 204; duplicate-safe. |
| `GET /api/synapse/status` | Catalog sync state, event count, top learned genres/artists, current exploration ratio, last mix time. Useful for debugging and the Home warming state. |
| `DELETE /api/synapse/profile` | Reset learned data for the current user; keeps favorites. |

Mix response shape:

```json
{
  "mix_id": "uuid",
  "status": "ready",
  "catalog_synced_at": "...",
  "filters": { "familiarity": ["familiar","unfamiliar"], "mood": null },
  "tracks": [
    {
      "...track fields...": "...",
      "synapse": {
        "session_id": "uuid",
        "reason": "Потому что вам нравится Artist",
        "channel": "favorite_artist",
        "score": 0.82
      }
    }
  ]
}
```

No endpoint calls Navidrome during mix generation; it reads the local catalog. This keeps mixes fast and resilient.

---

## 7. Backend implementation layout

New package:

```text
backend/app/recommendation/
  __init__.py
  models.py          # catalog, taste, cooldown, session, event tables
  genres.py          # normalization, alias seed loading, fuzzy matching
  artists.py         # multi-artist parsing/resolution, artist edges
  catalog.py         # search3 sync, upserts, serializers, sync status
  signals.py         # event -> taste/state/cooldown/mood updates
  learning.py        # online logistic model, priors, adaptation
  engine.py          # candidate generation, features, scoring, MMR
  service.py         # mix/refill/reset/status orchestration
  schemas.py         # Pydantic request/response models
  router.py          # /api/synapse
  data/
    genre_aliases.json
    mood_priors.json
```

Changes to existing files:

- `backend/app/database.py`: import recommendation models before `create_all`.
- `backend/app/main.py`: include router; start/stop catalog sync task in lifespan.
- `backend/app/routers/library.py`: extract the existing `split_artist_names` helper into a shared location, or import it from the new artist module without changing its behavior.
- Favorites router: no algorithm hook needed because favorites are read as anchors at mix time. Keep the existing favorite/unfavorite behavior exactly as it is.
- Docs: update `docs/ARCHITECTURE.md` and `docs/BACKEND.md` with the new tables, sync job, endpoints, and algorithm.

No new Python dependency is required. The model and math fit in the standard library.

---

## 8. Frontend implementation layout

New files:

```text
frontend/src/api/synapse.ts
frontend/src/types/synapse.ts
frontend/src/store/synapseStore.ts          # persisted filters
frontend/src/hooks/useSynapseMix.ts
frontend/src/hooks/useSynapseTelemetry.ts
frontend/src/hooks/useSynapseAutoContinue.ts
frontend/src/components/synapse/SynapseSection.tsx
frontend/src/components/synapse/SynapseFilters.tsx
frontend/src/components/synapse/SynapseTrackRow.tsx
```

Changes:

- `HomePage.tsx`: insert `<SynapseSection />` at the top, hidden during search.
- `playerStore.ts`:
  - add `queueEnded: boolean`
  - set it when `nextTrack()` reaches the end with repeat off
  - clear it on `setQueue`
  - add `appendToQueue(tracks)` that appends and starts the first new track if the queue had ended
- `useAudioEngine.ts`: no major rewrite; ensure end-of-queue still calls `nextTrack()` so `queueEnded` is set.
- `AppShell.tsx`: mount telemetry and auto-continue hooks once.
- `SettingsModal.tsx`: add “Continue playback” toggle under playback/audio.
- Settings store: add `continuePlayback: boolean`, default false, persisted with the existing local settings.
- `types/subsonic.ts`: add optional OpenSubsonic fields if needed: `artists`, `genres`, `moods`, `bpm`, `originalDate`, `releaseDate`, `displayArtist`.
- `types/synapse.ts`: `SynapseTrack = Track & { synapse: { session_id, reason, channel, score } }`.

Player behavior for auto-continue:

1. Last track ends → `nextTrack()` finds no next track → `queueEnded = true`.
2. `useSynapseAutoContinue` sees it, checks `continuePlayback`.
3. Calls refill with the last filters and current queue IDs.
4. On success, `appendToQueue(newTracks)`, which starts the first new track.
5. On failure or if the user started a new queue meanwhile, discard the response and stay stopped.

Telemetry only reads the `synapse` property on the current track. Tracks without it are ignored.

---

## 9. Testing and verification

Backend tests (`backend/tests/`):

- Genre normalization:
  - EN/RU aliases, abbreviations, compounds, multi-genre tags, unknown tags, `ё`, `&`, case, punctuation.
- Artist normalization:
  - primary + featured artists, multi-artist strings, collaboration edges.
- Year normalization:
  - `originalDate`, `releaseDate`, fallback year, invalid years.
- Catalog sync:
  - paged upsert, inactive marking, alias-version re-normalization, sync failure keeps old catalog.
- Filters:
  - Familiar only, Unfamiliar only, Favorites only, combinations, insufficient Favorites.
- Scoring:
  - favorite artist outranks unknown, bridge artist appears, mood soft filter, no duplicates, caps, cooldown exclusion.
- Learning:
  - completion raises affinity; early skip lowers it; neutral skip does not; liked-artist skip cooldowns album only; repeated skips escalate artist cooldown; unfamiliar ratio adapts.
- Mood:
  - completion in Sad session raises that track’s Sad score; skip lowers it; general taste is protected at half weight.
- API:
  - auth scoping, refill excludes session tracks, event idempotency, reset clears only current user’s profile.
- Performance:
  - synthetic 100k-track catalog; mix generation target under ~200ms, preferably under 100ms after warm cache.

Frontend verification:

- `npm run build`
- existing frontend checks
- pure helper tests for filter serialization and skip classification using the project’s `node:test` pattern if practical
- manual QA:
  - first mix with no history
  - mix with only favorites
  - unfamiliar-only mix
  - each mood and clearing mood
  - skip within 5 seconds → next mix avoids artist/album correctly
  - skip a track from a favorite artist → artist stays, album disappears
  - auto-continue from an album, playlist, and single track
  - disable Continue playback → queue stops normally
  - reset profile → favorites remain, mix returns to cold start

---

## 10. Implementation sequence

This is a substantial feature, roughly 1,500–2,000 lines of backend code plus tests and 500–700 lines of frontend code. Realistic order:

1. **Schema + catalog sync**
   - models, alias/mood seed files, sync task, status endpoint.
   - Verify a full library sync and normalized genres on real Navidrome data.
2. **Event pipeline**
   - events table, telemetry hook, track metadata, idempotent event processing, taste/cooldown updates.
   - Verify with a small number of manual Synapse plays.
3. **Engine with prior weights**
   - candidate generation, scoring, diversity, filters, reasons, API.
   - Verify mixes before online learning is active.
4. **Online learning + mood**
   - per-user weights, adaptive exploration, mood profiles, cooldown escalation.
   - Verify adaptation with simulated events.
5. **Home UI + auto-continue**
   - section, chips, settings toggle, queue append behavior.
6. **Tests, tuning, docs**
   - thresholds, cooldown lengths, weights, performance, documentation.

---

## 11. Defaults to confirm

Unless you want different values:

- Initial mix: 20 tracks; auto-continue adds 15.
- Default chips: Familiar + Unfamiliar; Favorites off; no mood.
- Familiar/unfamiliar split: 75/25, adapting between 10% and 45% unfamiliar.
- Continue playback: off by default.
- Strong skip: under `min(20s, 25% duration)`.
- Weak skip: under `min(60s, 50% duration)`.
- Cooldowns:
  - liked artist: album 3 days, track 3 days, artist not banned
  - otherwise: artist 3 days, album 7 days, track 14 days
  - repeated artist skips: 7 days, then 14 days
- No genre-level hard cooldown.
- Favorites-only with too few tracks returns a partial mix rather than adding unrelated artists.

Key limitations to keep in mind:

- Synapse-only learning means normal album/playlist listening does not make an artist “familiar”; only favorites and Synapse behavior do.
- Mood inference is behavioral plus tags/BPM, not acoustic analysis. It will need a few skips/completions per mood to become useful.
- Genre normalization is only as good as the alias map; unknown genres are kept, but some may land in the `other` family.
- There is no cross-user collaborative filtering. At household scale it would be noisy; the content/behavior hybrid is the better fit. If the user base grows, artist/genre co-occurrence across users can be added later as another candidate channel.
- The first mix after a reset or for a user with no favorites will be exploration-heavy and may be hit-or-miss; that is expected.
