from fastapi import Request, Depends, HTTPException, Cookie, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import httpx
from app.database import get_db
from app.models import Session, User
from app.auth import get_session_by_id, generate_salt, generate_subsonic_token
from app.subsonic_client import SubsonicClient
from app.config import settings


async def get_httpx_client(request: Request) -> httpx.AsyncClient:
    """Dependency to get shared httpx client"""
    if not hasattr(request.app.state, "httpx_client") or request.app.state.httpx_client is None:
        request.app.state.httpx_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, read=60.0),
            follow_redirects=False,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
        )
    return request.app.state.httpx_client


async def get_current_session(
    session_id: Optional[str] = Cookie(None, alias="session_id"),
    session_token: Optional[str] = Query(None, alias="session_id"),
    db: AsyncSession = Depends(get_db)
) -> Session:
    """
    Dependency to get current authenticated session from cookie or query parameter
    """
    token = session_id or session_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await get_session_by_id(db, token)
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    return session


async def get_current_user(
    session: Session = Depends(get_current_session),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated User model
    """
    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(
    user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require admin role
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
    return user


async def get_subsonic_client(
    httpx_client: httpx.AsyncClient = Depends(get_httpx_client)
) -> SubsonicClient:
    """
    Dependency to get system Subsonic client configured with Navidrome credentials from .env
    """
    username = settings.navidrome_user
    if settings.navidrome_token and settings.navidrome_salt:
        token = settings.navidrome_token
        salt = settings.navidrome_salt
    elif settings.navidrome_pass:
        salt = generate_salt()
        token = generate_subsonic_token(settings.navidrome_pass, salt)
    else:
        # Fallback to dev settings or dummy
        salt = generate_salt()
        token = generate_subsonic_token(settings.dev_navidrome_pass or "", salt)
    
    return SubsonicClient(
        httpx_client=httpx_client,
        base_url=settings.navidrome_url,
        username=username,
        token=token,
        salt=salt
    )
