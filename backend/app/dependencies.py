from fastapi import Request, Depends, HTTPException, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import httpx
from app.database import get_db
from app.models import Session
from app.auth import get_session_by_id, decrypt_value
from app.subsonic_client import SubsonicClient


async def get_httpx_client(request: Request) -> httpx.AsyncClient:
    """Dependency to get shared httpx client"""
    return request.app.state.httpx_client


async def get_current_session(
    session_id: Optional[str] = Cookie(None, alias="session_id"),
    db: AsyncSession = Depends(get_db)
) -> Session:
    """
    Dependency to get current authenticated session from cookie
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    return session


async def get_subsonic_client(
    session: Session = Depends(get_current_session),
    httpx_client: httpx.AsyncClient = Depends(get_httpx_client)
) -> SubsonicClient:
    """
    Dependency to get configured Subsonic client for current session
    """
    return SubsonicClient(
        httpx_client=httpx_client,
        base_url=decrypt_value(session.navidrome_url),
        username=decrypt_value(session.username),
        token=session.subsonic_token,
        salt=session.salt
    )
