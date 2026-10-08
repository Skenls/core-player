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

@router.get("/albums")
async def get_albums(
    type: Literal["recent", "frequent", "random", "newest", "starred", "alphabeticalByName", "byYear", "byGenre"] = "newest",
    size: int = Query(default=50, le=500),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get list of albums"""
    response = await client.get("getAlbumList2.view", type=type, size=size)
    albums = response.get("albumList2", {}).get("album", [])
    if isinstance(albums, dict):
        albums = [albums]
    elif not isinstance(albums, list):
        albums = []
    return {"albums": albums}


@router.get("/albums/{album_id}")
async def get_album(
    album_id: str,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get album details with tracks"""
    response = await client.get("getAlbum.view", id=album_id)
    album = response.get("album", {})
    return {"album": album}


@router.get("/artists")
async def get_artists(
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get all artists (indexed)"""
    response = await client.get("getArtists.view")
    artists = []
    indexes = response.get("artists", {}).get("index", [])
    for index in indexes:
        artists.extend(index.get("artist", []))
    return {"artists": artists}


@router.get("/artists/{artist_id}")
async def get_artist(
    artist_id: str,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Get artist details with albums"""
    response = await client.get("getArtist.view", id=artist_id)
    artist = response.get("artist", {})
    return {"artist": artist}


@router.get("/search")
async def search(
    query: str = Query(..., min_length=2),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """Search for tracks, albums, and artists"""
    response = await client.get("search3.view", query=query)
    results = response.get("searchResult3", {})
    return {"results": results}


@router.get("/random")
async def get_random_tracks(
    size: int = Query(default=50, le=500),
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
