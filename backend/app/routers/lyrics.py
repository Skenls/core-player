from fastapi import APIRouter, Depends, Response
from typing import Optional
from app.dependencies import get_subsonic_client, get_httpx_client
from app.subsonic_client import SubsonicClient
from app.lyrics import get_lyrics
import httpx


router = APIRouter(prefix="/lyrics", tags=["lyrics"])


@router.get("/{track_id}")
async def get_track_lyrics(
    track_id: str,
    artist: str,
    title: str,
    response: Response,
    album: Optional[str] = None,
    duration: Optional[int] = None,
    client: SubsonicClient = Depends(get_subsonic_client),
    httpx_client: httpx.AsyncClient = Depends(get_httpx_client)
):
    """
    Get lyrics for a track with fallback chain:
    1. Navidrome (embedded/LRC files)
    2. LRCLIB API
    """
    lyrics = await get_lyrics(
        track_id=track_id,
        artist=artist,
        title=title,
        album=album,
        duration=duration,
        subsonic_client=client,
        httpx_client=httpx_client
    )
    
    if lyrics and (lyrics.get("synced") or lyrics.get("text")):
        response.headers["Cache-Control"] = "private, max-age=86400"
    else:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    return lyrics
