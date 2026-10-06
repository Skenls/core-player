from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.dependencies import get_subsonic_client, get_httpx_client
from app.subsonic_client import SubsonicClient
import httpx


router = APIRouter(prefix="/stream", tags=["stream"])


@router.get("/{track_id}")
async def stream_audio(
    track_id: str,
    request: Request,
    client: SubsonicClient = Depends(get_subsonic_client)
):
    """
    Stream audio with HTTP Range request support for seeking
    """
    # Get Range header from client
    range_header = request.headers.get("range")
    
    headers = {}
    if range_header:
        headers["Range"] = range_header
    
    # Get streaming response from Navidrome
    navidrome_response = await client.stream_raw(
        "stream.view",
        headers=headers,
        id=track_id
    )
    
    # Build response headers
    response_headers = {
        "Content-Type": navidrome_response.headers.get("content-type", "audio/mpeg"),
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
