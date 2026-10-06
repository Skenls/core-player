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
    Fetch synchronized lyrics from LRCLIB API with smart fallback search.
    Returns: {plainLyrics: str, syncedLyrics: str} or None
    """
    plain_candidate = None

    # 1. Try exact get with all provided params
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
            data = response.json()
            if data.get("syncedLyrics"):
                return data
            if data.get("plainLyrics"):
                plain_candidate = data
    except Exception:
        pass

    # 2. Try exact get without album/duration constraints
    if album_name or duration:
        try:
            response = await httpx_client.get(
                "https://lrclib.net/api/get",
                params={"track_name": track_name, "artist_name": artist_name},
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("syncedLyrics"):
                    return data
                if data.get("plainLyrics") and not plain_candidate:
                    plain_candidate = data
        except Exception:
            pass

    # 3. Try search endpoint with track_name and artist_name
    try:
        search_res = await httpx_client.get(
            "https://lrclib.net/api/search",
            params={"track_name": track_name, "artist_name": artist_name},
            timeout=5.0
        )
        if search_res.status_code == 200:
            items = search_res.json()
            if isinstance(items, list):
                # Look for synced lyrics first
                for item in items:
                    if item.get("syncedLyrics"):
                        return item
                if not plain_candidate and items:
                    for item in items:
                        if item.get("plainLyrics"):
                            plain_candidate = item
                            break
    except Exception:
        pass

    # 4. Try general query search `q={artist} {track}`
    clean_title = re.sub(r'[\(\[].*?[\)\]]', '', track_name).strip()
    clean_artist = re.sub(r'[\(\[].*?[\)\]]', '', artist_name).strip()
    queries = [f"{artist_name} {track_name}"]
    if clean_title != track_name or clean_artist != artist_name:
        queries.append(f"{clean_artist} {clean_title}")

    for q in queries:
        try:
            search_res = await httpx_client.get(
                "https://lrclib.net/api/search",
                params={"q": q},
                timeout=5.0
            )
            if search_res.status_code == 200:
                items = search_res.json()
                if isinstance(items, list):
                    for item in items:
                        if item.get("syncedLyrics"):
                            return item
                    if not plain_candidate and items:
                        for item in items:
                            if item.get("plainLyrics"):
                                plain_candidate = item
                                break
        except Exception:
            pass

    return plain_candidate


def parse_lrc(lrc_text: str) -> list[dict]:
    """
    Parse LRC format into [{time: float, text: str}]
    Format: [mm:ss.xx]Line text or [mm:ss]Line text
    """
    lines = []
    
    for raw_line in lrc_text.split('\n'):
        line = raw_line.strip()
        if not line:
            continue
            
        # Match [mm:ss.xx] or [mm:ss]
        matches = re.findall(r'\[(\d+):(\d+(?:\.\d+)?)\]', line)
        if matches:
            # Extract text after all timestamp tags
            clean_text = re.sub(r'\[\d+:\d+(?:\.\d+)?\]', '', line).strip()
            for minutes, seconds in matches:
                time_seconds = int(minutes) * 60 + float(seconds)
                lines.append({"time": time_seconds, "text": clean_text})
    
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
    Fetch lyrics with robust fallback chain:
    1. Try Navidrome getLyricsBySongId.view / getLyrics.view for synced lyrics
    2. Try LRCLIB API for synced lyrics
    3. If no synced lyrics, fallback to plain lyrics formatted cleanly
    """
    plain_fallback_text = ""

    # 1. Try Navidrome getLyricsBySongId (OpenSubsonic) or getLyrics
    try:
        # Try getLyricsBySongId first
        try:
            song_lyrics = await subsonic_client.get("getLyricsBySongId.view", id=track_id)
            lyrics_list = song_lyrics.get("lyricsList", {}).get("structuredLyrics", [])
            if lyrics_list:
                for item in lyrics_list:
                    synced = item.get("synced", False)
                    lines_data = item.get("line", [])
                    if synced and lines_data:
                        lines = [
                            {"time": float(l.get("start", 0)) / 1000.0, "text": l.get("value", "")}
                            for l in lines_data
                        ]
                        return {
                            "text": "\n".join(l["text"] for l in lines),
                            "synced": True,
                            "lines": lines
                        }
        except Exception:
            pass

        # Try classic getLyrics.view
        navidrome_lyrics = await subsonic_client.get("getLyrics.view", artist=artist, title=title)
        lyrics_data = navidrome_lyrics.get("lyrics", {})
        
        if lyrics_data:
            lyrics_text = lyrics_data.get("value", "")
            if "[" in lyrics_text and "]" in lyrics_text:
                lines = parse_lrc(lyrics_text)
                if lines:
                    return {
                        "text": lyrics_text,
                        "synced": True,
                        "lines": lines
                    }
            if lyrics_text and not plain_fallback_text:
                plain_fallback_text = lyrics_text
    except Exception:
        pass

    # 2. Try LRCLIB for synced lyrics
    lrclib_data = await fetch_lrclib_lyrics(
        httpx_client, title, artist, album, duration
    )
    
    if lrclib_data:
        synced_lyrics = lrclib_data.get("syncedLyrics")
        plain_lyrics = lrclib_data.get("plainLyrics")
        
        if synced_lyrics:
            lines = parse_lrc(synced_lyrics)
            if lines:
                return {
                    "text": synced_lyrics,
                    "synced": True,
                    "lines": lines
                }
        
        if plain_lyrics and not plain_fallback_text:
            plain_fallback_text = plain_lyrics

    # 3. Fallback to plain lyrics formatted line-by-line
    if plain_fallback_text:
        formatted_lines = [
            {"time": 0, "text": line}
            for line in plain_fallback_text.splitlines()
        ]
        return {
            "text": plain_fallback_text,
            "synced": False,
            "lines": formatted_lines
        }

    # No lyrics found
    return {
        "text": "",
        "synced": False,
        "lines": None
    }
