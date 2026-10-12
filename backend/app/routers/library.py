from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, update
from pydantic import BaseModel
import asyncio
from app.dependencies import get_subsonic_client, get_current_user
from app.subsonic_client import SubsonicClient
from app.database import get_db
from app.models import User, Favorite, Playlist, PlaylistTrack


router = APIRouter(prefix="/library", tags=["library"])


class ToggleFavoriteRequest(BaseModel):
    id: str
    type: Literal["track", "album"]


class CreatePlaylistRequest(BaseModel):
    name: str


class AddTrackRequest(BaseModel):
    track_id: str


class ReorderPlaylistRequest(BaseModel):
    track_ids: list[str]


# ==========================================
# Albums & Artists & Search (from Navidrome)
# ==========================================

import re

PATRONYMIC_REGEX = re.compile(
    r'(?:ович|евич|ич|овна|евна|ична|инична|ovich|evich|ich|ovna|evna|ichna|inichna|ovych|evych|ivna|avna)$',
    re.IGNORECASE
)
RUSSIAN_SURNAME_REGEX = re.compile(
    r'(?:ов|ова|ев|ева|ёв|ёва|ин|ина|ын|ына|ский|ская|ской|цкий|цкая|енко|чук|'
    r'ov|ova|ev|eva|off|in|ina|yn|yna|sky|skiy|skaya|tsky|tskiy|enko|chuk)$',
    re.IGNORECASE
)
COMMON_FIRST_NAME_REGEX = re.compile(
    r'^(?:'
    r'dmitri|dmitriy|dmitry|dima|sergei|sergey|serezha|nikolai|nikolay|kolya|'
    r'grigori|grigoriy|grigory|grisha|aleksandr|alexander|alexandr|sasha|shura|'
    r'aleksei|aleksey|alexey|lesha|ivan|vanya|mikhail|misha|maksim|maxim|'
    r'artem|artyom|tema|danil|daniil|danila|danya|vladimir|vova|volodya|'
    r'vladislav|vlad|denis|pavel|pasha|egor|ilya|ilyusha|kirill|timur|'
    r'roman|roma|anton|antoha|oleg|gleb|matvey|yaroslav|fedor|fedya|stepan|styopa|'
    r'anna|anya|elena|lena|olga|olya|tatiana|tatyana|tanya|ekaterina|katya|'
    r'maria|masha|anastasia|nastya|polina|daria|dasha|alisa|ksenia|ksyusha|'
    r'дмитрий|дима|сергей|серёжа|николай|коля|григорий|гриша|александр|саша|'
    r'алексей|лёша|иван|ваня|михаил|миша|максим|артём|артем|данил|даниил|данила|'
    r'владимир|вова|владислав|влад|денис|павел|паша|егор|илья|кирилл|тимур|роман|'
    r'антон|олег|глеб|матвей|ярослав|фёдор|федор|степан|стёпа|'
    r'анна|елена|ольга|татьяна|екатерина|мария|анастасия|полина|дарья|алиса|ксения'
    r')$',
    re.IGNORECASE
)

def is_fio(name: str) -> bool:
    """Checks if a string is a legal person name (FIO / Firstname Lastname)."""
    trimmed = name.strip()
    if not trimmed:
        return False
    if re.search(r'^(?:ф\s*[.\s]*и\s*[.\s]*о|фио|f\s*[.\s]*i\s*[.\s]*o|fio)$', trimmed, re.I):
        return True
    words = [w for w in re.split(r'\s+', trimmed) if w]
    if len(words) in (2, 3, 4):
        # 1. Patronymic word in Cyrillic or Latin
        if any(PATRONYMIC_REGEX.search(w) for w in words):
            return True
        # 2. Initials (e.g. "D. O.", "И. И.", "D.")
        if any(re.match(r'^(?:[A-Za-zА-Яа-яЁё]\.)$', w) for w in words):
            return True
        # 3. First name + Russian/Slavic surname ending (e.g. "Dmitri Itskov", "Николай Паньков")
        has_first = any(COMMON_FIRST_NAME_REGEX.match(w.rstrip('.')) for w in words)
        has_surname = any(RUSSIAN_SURNAME_REGEX.search(w) for w in words)
        if has_first and has_surname:
            return True
    return False

def split_artist_names(artist_name: str) -> list[str]:
    """Splits compound artist names into individual constituent names."""
    if not artist_name:
        return []
    parts = re.split(r'(?:,\s*|\s+&\s+|\s+(?:feat\.?|ft\.?|featuring|with|x)\s+|\s+/\s+)', artist_name, flags=re.I)
    return [p.strip() for p in parts if p.strip() and not is_fio(p.strip())]

# Global maps for album split companions and artist duo associations
ALBUM_SPLITS_MAP: dict[str, list[str]] = {}
ARTIST_COLLAB_MAP: dict[str, list[str]] = {}

def deduplicate_albums_backend(albums: list[dict]) -> list[dict]:
    """
    Groups and merges split album entries by normalized title and matching artist/year.
    """
    if not albums:
        return []

    grouped: dict[str, list[dict]] = {}

    for alb in albums:
        title = (alb.get("name") or "").strip().lower()
        if not title:
            continue
        artist_raw = (alb.get("artist") or "").strip()
        year = alb.get("year") or 0

        # Find matching group with same title
        matched_key = None
        for key, group in grouped.items():
            first = group[0]
            first_title = (first.get("name") or "").strip().lower()
            if title == first_title:
                first_artist_raw = (first.get("artist") or "").strip()
                first_year = first.get("year") or 0

                # Check artist overlap
                artist_tokens = [a.lower() for a in split_artist_names(artist_raw)]
                first_artist_tokens = [a.lower() for a in split_artist_names(first_artist_raw)]

                overlap = False
                if not artist_tokens or not first_artist_tokens:
                    overlap = True
                else:
                    for t in artist_tokens:
                        if any(t in ft or ft in t for ft in first_artist_tokens):
                            overlap = True
                            break

                # If distinct different years AND zero artist overlap, treat as separate releases
                if year and first_year and year != first_year and not overlap:
                    continue

                matched_key = key
                break

        if matched_key is None:
            group_key = f"{title}_{len(grouped)}"
            grouped[group_key] = [alb]
        else:
            grouped[matched_key].append(alb)

    result = []
    for group in grouped.values():
        if len(group) == 1:
            primary = dict(group[0])
            primary_id = primary.get("id")
            if primary_id:
                primary["splitIds"] = [primary_id]
                ALBUM_SPLITS_MAP[primary_id] = [primary_id]
            result.append(primary)
        else:
            # Score albums to find primary: prefer solo artist and more songs
            def score(a):
                art = a.get("artist") or ""
                has_comma = "," in art or "&" in art or "feat" in art.lower()
                return (not has_comma, a.get("songCount") or 0)

            sorted_group = sorted(group, key=score, reverse=True)
            primary = dict(sorted_group[0])
            all_ids = [a["id"] for a in group if a.get("id")]
            primary["splitIds"] = all_ids
            primary["songCount"] = sum(a.get("songCount", 0) for a in group)
            primary["duration"] = sum(a.get("duration", 0) for a in group)

            for a in group:
                if a.get("id"):
                    ALBUM_SPLITS_MAP[a["id"]] = all_ids

            result.append(primary)

    return result

@router.get("/albums")
async def get_albums(
    type: Literal["recent", "frequent", "random", "newest", "starred", "alphabeticalByName", "byYear", "byGenre"] = "newest",
    size: int = Query(default=50, le=500),
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get list of albums, deduplicated by release title and artist"""
    response = await client.get("getAlbumList2.view", type=type, size=size)
    albums = response.get("albumList2", {}).get("album", [])
    if isinstance(albums, dict):
        albums = [albums]
    elif not isinstance(albums, list):
        albums = []
    return {"albums": deduplicate_albums_backend(albums)}


@router.get("/albums/{album_id}")
async def get_album(
    album_id: str,
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get album details with tracks, merging companion split albums if present"""
    split_ids = ALBUM_SPLITS_MAP.get(album_id, [album_id])

    # If not in map yet, fetch album and see if other albums in library share the same title
    if len(split_ids) <= 1:
        response = await client.get("getAlbum.view", id=album_id)
        main_album = response.get("album", {})
        album_name = (main_album.get("name") or "").strip().lower()
        if album_name:
            list_resp = await client.get("getAlbumList2.view", type="newest", size=500)
            all_albs = list_resp.get("albumList2", {}).get("album", [])
            if isinstance(all_albs, dict):
                all_albs = [all_albs]
            elif not isinstance(all_albs, list):
                all_albs = []
            deduplicate_albums_backend(all_albs)
            split_ids = ALBUM_SPLITS_MAP.get(album_id, [album_id])

    if len(split_ids) <= 1:
        response = await client.get("getAlbum.view", id=album_id)
        return {"album": response.get("album", {})}

    # Fetch all splits concurrently
    responses = await asyncio.gather(
        *(client.get("getAlbum.view", id=sid) for sid in split_ids),
        return_exceptions=True
    )

    valid_albums = [r.get("album", {}) for r in responses if isinstance(r, dict) and "album" in r]
    if not valid_albums:
        response = await client.get("getAlbum.view", id=album_id)
        return {"album": response.get("album", {})}

    primary = dict(valid_albums[0])
    seen_track_ids = set()
    all_songs = []

    for alb in valid_albums:
        songs = alb.get("song", [])
        if isinstance(songs, dict):
            songs = [songs]
        elif not isinstance(songs, list):
            songs = []
        for s in songs:
            s_id = s.get("id")
            if s_id and s_id not in seen_track_ids:
                seen_track_ids.add(s_id)
                all_songs.append(s)

    all_songs.sort(key=lambda s: (int(s.get("discNumber") or 1), int(s.get("track") or 0)))

    primary["song"] = all_songs
    primary["songCount"] = len(all_songs)
    primary["duration"] = sum(s.get("duration", 0) for s in all_songs)
    primary["splitIds"] = split_ids
    return {"album": primary}


@router.get("/artists")
async def get_artists(
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get all artists (indexed), excluding FIO legal names and deduplicating duos"""
    response = await client.get("getArtists.view")
    raw_artists = []
    indexes = response.get("artists", {}).get("index", [])
    for index in indexes:
        raw_artists.extend(index.get("artist", []))

    # 1. Filter out FIO legal names
    valid_artists = [a for a in raw_artists if not is_fio(a.get("name", ""))]

    # 2. Build set of solo artist names (lowercased)
    solo_artist_map: dict[str, dict] = {}
    for a in valid_artists:
        name = (a.get("name") or "").strip()
        parts = split_artist_names(name)
        if len(parts) <= 1:
            solo_artist_map[name.lower()] = a

    # 3. Detect duos / compound artists
    filtered_artists = []
    for a in valid_artists:
        name = (a.get("name") or "").strip()
        parts = split_artist_names(name)
        if len(parts) > 1:
            matching_solos = [solo_artist_map[p.lower()] for p in parts if p.lower() in solo_artist_map]
            if matching_solos:
                for solo in matching_solos:
                    solo_id = solo.get("id")
                    if solo_id:
                        collabs = ARTIST_COLLAB_MAP.setdefault(solo_id, [])
                        a_id = a.get("id")
                        if a_id and a_id not in collabs:
                            collabs.append(a_id)
                continue

        filtered_artists.append(a)

    return {"artists": filtered_artists}


@router.get("/artists/{artist_id}")
async def get_artist(
    artist_id: str,
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get artist details with albums, including deduplicated collab albums"""
    response = await client.get("getArtist.view", id=artist_id)
    main_artist = dict(response.get("artist", {}))

    collab_ids = ARTIST_COLLAB_MAP.get(artist_id, [])
    albums = main_artist.get("album", [])
    if isinstance(albums, dict):
        albums = [albums]
    elif not isinstance(albums, list):
        albums = []

    if collab_ids:
        collab_responses = await asyncio.gather(
            *(client.get("getArtist.view", id=cid) for cid in collab_ids),
            return_exceptions=True
        )
        for r in collab_responses:
            if isinstance(r, dict) and "artist" in r:
                c_albums = r["artist"].get("album", [])
                if isinstance(c_albums, dict):
                    c_albums = [c_albums]
                elif isinstance(c_albums, list):
                    albums.extend(c_albums)

    deduped_albums = deduplicate_albums_backend(albums)
    main_artist["album"] = deduped_albums
    main_artist["albumCount"] = len(deduped_albums)
    return {"artist": main_artist}


@router.get("/search")
async def search(
    query: str = Query(..., min_length=2),
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Search for tracks, albums, and artists"""
    response = await client.get("search3.view", query=query)
    results = dict(response.get("searchResult3", {}))

    if "artist" in results and isinstance(results["artist"], list):
        results["artist"] = [a for a in results["artist"] if not is_fio(a.get("name", ""))]

    if "album" in results and isinstance(results["album"], list):
        results["album"] = deduplicate_albums_backend(results["album"])

    return {"results": results}


@router.get("/random")
async def get_random_tracks(
    size: int = Query(default=50, le=500),
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get random tracks"""
    response = await client.get("getRandomSongs.view", size=size)
    tracks = response.get("randomSongs", {}).get("song", [])
    return {"tracks": tracks}


@router.post("/scrobble")
async def scrobble_track(
    id: str,
    time: int | None = None,
    user: User = Depends(get_current_user),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Scrobble a track (mark as played)"""
    params = {"id": id}
    if time is not None:
        params["time"] = time
    await client.get("scrobble.view", **params)
    return {"message": "Track scrobbled successfully"}


# ==========================================
# User Favorites (per user in SQLite)
# ==========================================

@router.get("/favorites/ids")
async def get_favorite_ids(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all favorited IDs for current user"""
    result = await db.execute(
        select(Favorite.item_id, Favorite.item_type).where(Favorite.user_id == user.id)
    )
    rows = result.all()
    track_ids = [r[0] for r in rows if r[1] == "track"]
    album_ids = [r[0] for r in rows if r[1] == "album"]
    return {
        "tracks": track_ids,
        "albums": album_ids
    }


@router.post("/favorites/toggle")
async def toggle_favorite(
    req: ToggleFavoriteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle favorite status for a track or album"""
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == user.id,
            Favorite.item_id == req.id,
            Favorite.item_type == req.type
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"starred": False, "id": req.id, "type": req.type}
    else:
        new_fav = Favorite(user_id=user.id, item_id=req.id, item_type=req.type)
        db.add(new_fav)
        await db.commit()
        return {"starred": True, "id": req.id, "type": req.type}


@router.get("/favorites/tracks")
async def get_favorite_tracks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get list of full track objects for user's starred tracks"""
    result = await db.execute(
        select(Favorite.item_id).where(
            Favorite.user_id == user.id,
            Favorite.item_type == "track"
        ).order_by(Favorite.created_at.desc())
    )
    track_ids = result.scalars().all()
    
    async def fetch_song(tid: str):
        try:
            res = await client.get("getSong.view", id=tid)
            song = res.get("song")
            if song:
                song["starred"] = True
            return song
        except Exception:
            return None
    
    tasks = [fetch_song(tid) for tid in track_ids]
    results = await asyncio.gather(*tasks)
    tracks = [r for r in results if r is not None]
    return {"tracks": tracks}


@router.get("/favorites/albums")
async def get_favorite_albums(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get list of full album objects for user's starred albums"""
    result = await db.execute(
        select(Favorite.item_id).where(
            Favorite.user_id == user.id,
            Favorite.item_type == "album"
        ).order_by(Favorite.created_at.desc())
    )
    album_ids = result.scalars().all()
    
    async def fetch_album(aid: str):
        try:
            res = await client.get("getAlbum.view", id=aid)
            album = res.get("album")
            if album:
                album["starred"] = True
            return album
        except Exception:
            return None
    
    tasks = [fetch_album(aid) for aid in album_ids]
    results = await asyncio.gather(*tasks)
    albums = [r for r in results if r is not None]
    return {"albums": albums}


# ==========================================
# User Playlists (per user in SQLite)
# ==========================================

@router.get("/playlists")
async def get_playlists(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user playlists"""
    result = await db.execute(
        select(
            Playlist.id,
            Playlist.name,
            Playlist.created_at,
            func.count(PlaylistTrack.id).label("songCount")
        )
        .outerjoin(PlaylistTrack, Playlist.id == PlaylistTrack.playlist_id)
        .where(Playlist.user_id == user.id)
        .group_by(Playlist.id)
        .order_by(Playlist.created_at.desc())
    )
    playlists = [
        {
            "id": r[0],
            "name": r[1],
            "created": r[2].isoformat() if r[2] else "",
            "songCount": r[3]
        }
        for r in result.all()
    ]
    return {"playlists": playlists}


@router.post("/playlists")
async def create_playlist(
    req: CreatePlaylistRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new playlist"""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Название плейлиста не может быть пустым")
    
    new_pl = Playlist(user_id=user.id, name=req.name.strip())
    db.add(new_pl)
    await db.commit()
    await db.refresh(new_pl)
    return {
        "id": new_pl.id,
        "name": new_pl.name,
        "created": new_pl.created_at.isoformat(),
        "songCount": 0
    }


@router.get("/playlists/{playlist_id}")
async def get_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get playlist details and tracks"""
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    
    # Get tracks in playlist
    track_rows = await db.execute(
        select(PlaylistTrack.track_id)
        .where(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc(), PlaylistTrack.added_at.asc())
    )
    track_ids = track_rows.scalars().all()
    
    async def fetch_song(tid: str):
        try:
            res = await client.get("getSong.view", id=tid)
            return res.get("song")
        except Exception:
            return None
    
    tasks = [fetch_song(tid) for tid in track_ids]
    songs = await asyncio.gather(*tasks)
    valid_songs = [s for s in songs if s is not None]
    
    return {
        "playlist": {
            "id": playlist.id,
            "name": playlist.name,
            "created": playlist.created_at.isoformat() if playlist.created_at else "",
            "songCount": len(valid_songs),
            "entry": valid_songs
        }
    }


@router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: str,
    req: AddTrackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a track to playlist"""
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    
    # Check max position
    pos_res = await db.execute(
        select(func.coalesce(func.max(PlaylistTrack.position), 0))
        .where(PlaylistTrack.playlist_id == playlist.id)
    )
    next_pos = (pos_res.scalar() or 0) + 1
    
    pt = PlaylistTrack(
        playlist_id=playlist.id,
        track_id=req.track_id,
        position=next_pos
    )
    db.add(pt)
    await db.commit()
    return {"message": "Трек добавлен в плейлист"}


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a track from playlist"""
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    
    await db.execute(
        delete(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist.id,
            PlaylistTrack.track_id == track_id
        )
    )
    await db.commit()
    return {"message": "Трек удален из плейлиста"}


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a playlist"""
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    
    await db.delete(playlist)
    await db.commit()
    return {"message": "Плейлист удален"}


@router.put("/playlists/{playlist_id}/reorder")
async def reorder_playlist(
    playlist_id: str,
    req: ReorderPlaylistRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reorder tracks in playlist"""
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.user_id == user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")

    for index, track_id in enumerate(req.track_ids):
        await db.execute(
            update(PlaylistTrack)
            .where(PlaylistTrack.playlist_id == playlist.id, PlaylistTrack.track_id == track_id)
            .values(position=index + 1)
        )
    await db.commit()
    return {"message": "Порядок треков обновлен"}
