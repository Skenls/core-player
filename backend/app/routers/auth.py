from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, HttpUrl
from app.database import get_db
from app.auth import create_session, get_session_by_id, delete_session, decrypt_value
from app.dependencies import get_current_session, get_httpx_client
from app.subsonic_client import SubsonicClient
from app.models import Session
import httpx


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    navidrome_url: HttpUrl
    username: str
    password: str


class AuthResponse(BaseModel):
    username: str
    navidrome_url: str


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    httpx_client: httpx.AsyncClient = Depends(get_httpx_client)
):
    """
    Login with Navidrome credentials
    Validates credentials with ping.view and creates session
    """
    # Create temporary Subsonic client to test credentials
    from app.auth import generate_salt, generate_subsonic_token
    
    salt = generate_salt()
    token = generate_subsonic_token(credentials.password, salt)
    
    test_client = SubsonicClient(
        httpx_client=httpx_client,
        base_url=str(credentials.navidrome_url),
        username=credentials.username,
        token=token,
        salt=salt
    )
    
    # Test connection with ping
    try:
        await test_client.get("ping.view")
    except HTTPException as e:
        raise HTTPException(status_code=401, detail="Invalid Navidrome credentials or URL")
    
    # Create session
    session = await create_session(
        db=db,
        navidrome_url=str(credentials.navidrome_url),
        username=credentials.username,
        password=credentials.password
    )
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_id",
        value=session.id,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )
    
    return AuthResponse(
        username=credentials.username,
        navidrome_url=str(credentials.navidrome_url)
    )


@router.get("/me", response_model=AuthResponse)
async def get_current_user(
    session: Session = Depends(get_current_session)
):
    """Get current authenticated user"""
    return AuthResponse(
        username=decrypt_value(session.username),
        navidrome_url=decrypt_value(session.navidrome_url)
    )


@router.post("/logout")
async def logout(
    response: Response,
    session: Session = Depends(get_current_session),
    db: AsyncSession = Depends(get_db)
):
    """Logout current user"""
    await delete_session(db, session.id)
    
    # Clear cookie
    response.delete_cookie(key="session_id")
    
    return {"message": "Logged out successfully"}
