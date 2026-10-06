import httpx
from typing import Any, AsyncIterator
from fastapi import HTTPException


class SubsonicClient:
    """
    Async client for Subsonic API with automatic response unwrapping
    """
    
    def __init__(
        self,
        httpx_client: httpx.AsyncClient,
        base_url: str,
        username: str,
        token: str,
        salt: str
    ):
        self.client = httpx_client
        self.base_url = base_url.rstrip('/')
        self.auth_params = {
            "u": username,
            "t": token,
            "s": salt,
            "v": "1.16.1",
            "c": "core-player",
            "f": "json"
        }
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL for endpoint"""
        return f"{self.base_url}/rest/{endpoint}"
    
    async def get(self, endpoint: str, **params) -> dict[str, Any]:
        """
        Execute GET request and unwrap Subsonic response
        Raises HTTPException on Subsonic errors
        """
        url = self._build_url(endpoint)
        full_params = {**self.auth_params, **params}
        
        try:
            response = await self.client.get(url, params=full_params)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Navidrome connection error: {str(e)}")
        
        data = response.json()
        
        # Unwrap subsonic-response envelope
        subsonic_response = data.get("subsonic-response", {})
        
        if subsonic_response.get("status") == "failed":
            error = subsonic_response.get("error", {})
            raise HTTPException(
                status_code=400,
                detail=f"Subsonic error: {error.get('message', 'Unknown error')}"
            )
        
        return subsonic_response
    
    async def stream_raw(
        self,
        endpoint: str,
        headers: dict[str, str] | None = None,
        **params
    ) -> httpx.Response:
        """
        Get raw streaming response for audio/images
        Caller must call response.aclose() after use
        """
        url = self._build_url(endpoint)
        full_params = {**self.auth_params, **params}
        
        request = self.client.build_request(
            "GET",
            url,
            params=full_params,
            headers=headers or {}
        )
        
        try:
            response = await self.client.send(request, stream=True)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Navidrome streaming error: {str(e)}")
        
        return response
