import httpx
import re
from typing import Optional


async def fetch_lrclib_lyrics(
    httpx_client: httpx.AsyncClient,
    track_name: str,
    artist_name: str,
    album_name: Optional[str] = None,
    duration: Optional[int] = None
) -> Optional[dict]:
    """
    Fetch synchronized lyrics from LRCLIB API
    Returns: {plainLyrics: str, syncedLyrics: str} or None
    """
    params = {
        "track_name": track_name,
        "artist_name": artist_name
    }
    if album_name:
        params["album_name"] = album_name
    if duration:
        params["duration"] = duration
    
    try:
        response = await httpx_client.get(
            "https://lrclib.net/api/get",
            params=params,
            timeout=5.0
        )
        
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None


def parse_lrc(lrc_text: str) -> list[dict]:
    """
    Parse LRC format into [{time: float, text: str}]
    Format: [mm:ss.xx]Line text
    """
    lines = []
    
    for line in lrc_text.split('\n'):
        # Match [mm:ss.xx] or [mm:ss]
        match = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\](.*)', line)
        if match:
            minutes, seconds, text = match.groups()
            time_seconds = int(minutes) * 60 + float(seconds)
            lines.append({"time": time_seconds, "text": text.strip()})
    
    return sorted(lines, key=lambda x: x["time"])


async def get_lyrics(
    track_id: str,
    artist: str,
    title: str,
    album: Optional[str],
    duration: Optional[int],
    subsonic_client,
    httpx_client: httpx.AsyncClient
) -> dict:
    """
    Fetch lyrics with fallback chain:
    1. Navidrome getLyrics.view
    2. LRCLIB API
    
    Returns: {
        text: str,
        synced: bool,
        lines: [{time: float, text: str}] | None
    }
    """
    
    # 1. Try Navidrome
    try:
        navidrome_lyrics = await subsonic_client.get("getLyrics.view", artist=artist, title=title)
        lyrics_data = navidrome_lyrics.get("lyrics", {})
        
        if lyrics_data:
            lyrics_text = lyrics_data.get("value", "")
            
            # Check if synced (LRC format)
            if "[" in lyrics_text and "]" in lyrics_text:
                lines = parse_lrc(lyrics_text)
                return {
                    "text": lyrics_text,
                    "synced": True,
                    "lines": lines
                }
            else:
                return {
                    "text": lyrics_text,
                    "synced": False,
                    "lines": None
                }
    except Exception:
        pass
    
    # 2. Try LRCLIB
    lrclib_data = await fetch_lrclib_lyrics(
        httpx_client, title, artist, album, duration
    )
    
    if lrclib_data:
        synced_lyrics = lrclib_data.get("syncedLyrics")
        plain_lyrics = lrclib_data.get("plainLyrics")
        
        if synced_lyrics:
            lines = parse_lrc(synced_lyrics)
            return {
                "text": synced_lyrics,
                "synced": True,
                "lines": lines
            }
        elif plain_lyrics:
            return {
                "text": plain_lyrics,
                "synced": False,
                "lines": None
            }
    
    # No lyrics found
    return {
        "text": "",
        "synced": False,
        "lines": None
    }
