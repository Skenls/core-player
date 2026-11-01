import httpx
import re
import asyncio
import time
from typing import Optional


LRCLIB_HEADERS = {
    "User-Agent": "CorePlayer/1.0 (https://github.com/Skenls/core-player)"
}

# In-memory cache: track_id -> (timestamp, result_dict)
_LYRICS_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_TTL_SUCCESS = 86400 * 7  # 7 days for found lyrics
CACHE_TTL_EMPTY = 15           # 15 seconds for empty results to allow rapid retry


def extract_artist_candidates(artist_raw: str) -> list[str]:
    """
    Extract search candidates from artist metadata string.
    Cleans:
    - Bullet/pipe/slash/semicolon metadata separators: 'Kai Angel • Ицков Дмитрий Олегович' -> 'Kai Angel'
    - Multiple artists: 'Kai Angel, 9mice' -> ['Kai Angel, 9mice', 'Kai Angel & 9mice', 'Kai Angel', '9mice']
    - Parentheses and feats: 'Artist (feat. Other)' -> 'Artist'
    """
    candidates: list[str] = []
    
    def add_candidate(val: str):
        c = val.strip()
        if c and c not in candidates:
            candidates.append(c)

    # 1. Primary artist before bullet, dot, pipe, semicolon, or slash
    primary = re.split(r'[•·|;/]', artist_raw)[0].strip()
    if primary:
        add_candidate(primary)

    # 2. Raw artist
    add_candidate(artist_raw)

    # 3. Strip parentheses / brackets from primary
    no_parens = re.sub(r'[\(\[].*?[\)\]]', '', primary).strip()
    if no_parens:
        add_candidate(no_parens)

    # 4. If primary has commas or &, expand variations
    for c in list(candidates):
        if ',' in c:
            with_amp = re.sub(r'\s*,\s*', ' & ', c)
            add_candidate(with_amp)
            parts = [p.strip() for p in c.split(',') if p.strip()]
            for p in parts:
                add_candidate(p)
        if ' & ' in c:
            first = c.split(' & ')[0].strip()
            add_candidate(first)
        if ' feat. ' in c.lower() or ' ft. ' in c.lower():
            feat_clean = re.split(r'\s+(?:feat\.|ft\.|feat|ft)\s+', c, flags=re.IGNORECASE)[0].strip()
            add_candidate(feat_clean)

    return candidates


def extract_title_candidates(title_raw: str) -> list[str]:
    """Extract search candidates from title metadata."""
    candidates: list[str] = [title_raw.strip()]
    
    # Strip (feat. ...), [feat. ...], etc.
    no_feat = re.sub(r'\s*[\(\[](?:feat|ft|prod|official).*?[\)\]]', '', title_raw, flags=re.IGNORECASE).strip()
    if no_feat and no_feat not in candidates:
        candidates.append(no_feat)

    # Strip all parenthetical content
    no_parens = re.sub(r'\s*[\(\[].*?[\)\]]', '', title_raw).strip()
    if no_parens and no_parens not in candidates:
        candidates.append(no_parens)
        
    return candidates


async def fetch_lrclib_lyrics(
    httpx_client: httpx.AsyncClient,
    track_name: str,
    artist_name: str,
    album_name: Optional[str] = None,
    duration: Optional[int] = None
) -> Optional[dict]:
    """
    Fetch synchronized lyrics from LRCLIB API with smart fallback search across artist/title variations.
    Includes polite User-Agent, retry logic for 429 / transient timeouts, and fast search.
    Returns: {plainLyrics: str, syncedLyrics: str} or None
    """
    plain_candidate = None
    artist_candidates = extract_artist_candidates(artist_name)
    title_candidates = extract_title_candidates(track_name)

    primary_artist = artist_candidates[0] if artist_candidates else artist_name
    primary_title = title_candidates[0] if title_candidates else track_name

    async def safe_get(url: str, params: dict) -> Optional[dict | list]:
        for attempt in range(2):
            try:
                resp = await httpx_client.get(url, params=params, headers=LRCLIB_HEADERS, timeout=5.0)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 429:  # Rate limited, wait and retry once
                    await asyncio.sleep(0.5)
                    continue
                elif resp.status_code == 404:
                    return None
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.4)
        return None

    # 1. Try exact get with primary artist & title
    params = {"track_name": primary_title, "artist_name": primary_artist}
    if album_name:
        params["album_name"] = album_name
    if duration:
        params["duration"] = duration

    exact_data = await safe_get("https://lrclib.net/api/get", params)
    if isinstance(exact_data, dict):
        if exact_data.get("syncedLyrics"):
            return exact_data
        if exact_data.get("plainLyrics"):
            plain_candidate = exact_data

    # 2. Targeted fuzzy search queries
    queries = [f"{primary_artist} {primary_title}"]
    if len(title_candidates) > 1:
        queries.append(f"{primary_artist} {title_candidates[1]}")
    if len(artist_candidates) > 1 and artist_candidates[1] != primary_artist:
        queries.append(f"{artist_candidates[1]} {primary_title}")

    for q in queries:
        items = await safe_get("https://lrclib.net/api/search", {"q": q})
        if isinstance(items, list):
            for item in items:
                if item.get("syncedLyrics"):
                    return item
            if not plain_candidate:
                for item in items:
                    if item.get("plainLyrics"):
                        plain_candidate = item
                        break

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
    Fetch lyrics with robust fallback chain and in-memory caching:
    1. Check memory cache (instant response for repeated queries)
    2. Try Navidrome getLyricsBySongId.view / getLyrics.view for synced lyrics
    3. Try LRCLIB API for synced lyrics
    4. If no synced lyrics, fallback to plain lyrics formatted cleanly
    """
    now = time.time()

    # 1. Check in-memory cache
    if track_id in _LYRICS_CACHE:
        cached_time, cached_data = _LYRICS_CACHE[track_id]
        has_content = bool(cached_data.get("synced") or cached_data.get("text"))
        if has_content or (now - cached_time < CACHE_TTL_EMPTY):
            return cached_data

    plain_fallback_text = ""

    # 2. Try Navidrome getLyricsBySongId (OpenSubsonic) or getLyrics
    try:
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
                        res = {
                            "text": "\n".join(l["text"] for l in lines),
                            "synced": True,
                            "lines": lines
                        }
                        _LYRICS_CACHE[track_id] = (now, res)
                        return res
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
                    res = {
                        "text": lyrics_text,
                        "synced": True,
                        "lines": lines
                    }
                    _LYRICS_CACHE[track_id] = (now, res)
                    return res
            if lyrics_text and not plain_fallback_text:
                plain_fallback_text = lyrics_text
    except Exception:
        pass

    # 3. Try LRCLIB for synced lyrics (with retry on failure)
    lrclib_data = await fetch_lrclib_lyrics(
        httpx_client, title, artist, album, duration
    )
    
    if lrclib_data:
        synced_lyrics = lrclib_data.get("syncedLyrics")
        plain_lyrics = lrclib_data.get("plainLyrics")
        
        if synced_lyrics:
            lines = parse_lrc(synced_lyrics)
            if lines:
                res = {
                    "text": synced_lyrics,
                    "synced": True,
                    "lines": lines
                }
                _LYRICS_CACHE[track_id] = (now, res)
                return res
        
        if plain_lyrics and not plain_fallback_text:
            plain_fallback_text = plain_lyrics

    # 4. Fallback to plain lyrics formatted line-by-line
    if plain_fallback_text:
        formatted_lines = [
            {"time": 0, "text": line}
            for line in plain_fallback_text.splitlines()
        ]
        res = {
            "text": plain_fallback_text,
            "synced": False,
            "lines": formatted_lines
        }
        _LYRICS_CACHE[track_id] = (now, res)
        return res

    # 5. No lyrics found - cache briefly so retries can try again if lyrics arrive later
    empty_res = {
        "text": "",
        "synced": False,
        "lines": None
    }
    _LYRICS_CACHE[track_id] = (now, empty_res)
    return empty_res
