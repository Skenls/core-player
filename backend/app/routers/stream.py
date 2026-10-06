from fastapi import APIRouter, Depends, Request, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import os
import time
from app.dependencies import get_subsonic_client
from app.subsonic_client import SubsonicClient


router = APIRouter(prefix="/stream", tags=["stream"])

MIME_TYPES = {
    "mp3": "audio/mpeg",
    "opus": "audio/ogg",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "raw": "audio/mpeg"
}


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
CUSTOM_BG_FILE = os.path.join(DATA_DIR, "custom_background.jpg")


@router.post("/custom-background")
async def upload_custom_background(
    file: UploadFile = File(...)
):
    """Upload custom wallpaper image"""
    os.makedirs(DATA_DIR, exist_ok=True)
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")
    with open(CUSTOM_BG_FILE, "wb") as f:
        f.write(content)
    return {"url": f"/api/stream/custom-background?t={int(time.time())}"}


@router.get("/custom-background")
async def get_custom_background():
    """Get uploaded custom wallpaper image"""
    if os.path.exists(CUSTOM_BG_FILE):
        return FileResponse(
            CUSTOM_BG_FILE,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    raise HTTPException(status_code=404, detail="No custom background uploaded")


@router.get("/{track_id}")
async def stream_audio(
    track_id: str,
    request: Request,
    format: str | None = Query(default=None),
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """
    Stream audio with optional transcoding format and HTTP Range support
    """
    # Get Range header from client
    range_header = request.headers.get("range")
    
    headers = {}
    if range_header:
        headers["Range"] = range_header
    
    params = {"id": track_id}
    if format and format != "raw":
        params["format"] = format
    
    # Get streaming response from Navidrome
    navidrome_response = await client.stream_raw(
        "stream.view",
        headers=headers,
        **params
    )
    
    default_mime = MIME_TYPES.get(format or "mp3", "audio/mpeg")
    content_type = navidrome_response.headers.get("content-type") or default_mime
    
    # Build response headers
    response_headers = {
        "Content-Type": content_type,
        "Accept-Ranges": "bytes"
    }
    
    # Handle partial content (206)
    if navidrome_response.status_code == 206:
        if "content-range" in navidrome_response.headers:
            response_headers["Content-Range"] = navidrome_response.headers["content-range"]
        if "content-length" in navidrome_response.headers:
            response_headers["Content-Length"] = navidrome_response.headers["content-length"]
    elif "content-length" in navidrome_response.headers:
        response_headers["Content-Length"] = navidrome_response.headers["content-length"]
    
    async def stream_with_cleanup():
        """Generator with guaranteed cleanup"""
        try:
            async for chunk in navidrome_response.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await navidrome_response.aclose()
    
    return StreamingResponse(
        stream_with_cleanup(),
        status_code=navidrome_response.status_code,
        headers=response_headers,
        media_type=response_headers["Content-Type"]
    )


@router.get("/cover/{cover_id}")
async def get_cover(
    cover_id: str,
    size: int = 300,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """
    Get album cover art
    """
    navidrome_response = await client.stream_raw(
        "getCoverArt.view",
        id=cover_id,
        size=size
    )
    
    response_headers = {
        "Content-Type": navidrome_response.headers.get("content-type", "image/jpeg"),
        "Cache-Control": "public, max-age=31536000"  # Cache for 1 year
    }
    
    if "content-length" in navidrome_response.headers:
        response_headers["Content-Length"] = navidrome_response.headers["content-length"]
    
    async def stream_with_cleanup():
        try:
            async for chunk in navidrome_response.aiter_bytes(chunk_size=8192):
                yield chunk
        finally:
            await navidrome_response.aclose()
    
    return StreamingResponse(
        stream_with_cleanup(),
        headers=response_headers,
        media_type=response_headers["Content-Type"]
    )
