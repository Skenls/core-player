from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import asyncio
from app.database import get_db
from app.auth import create_session, delete_session, verify_password
from app.dependencies import get_current_session, get_current_user
from app.models import Session, User


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    id: str
    username: str
    role: str


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with local username and password
    """
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="Неверное имя пользователя или пароль")
    
    # Run CPU-bound bcrypt verification in worker thread to prevent event loop freeze
    is_valid = await asyncio.to_thread(verify_password, credentials.password, user.password_hash)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Неверное имя пользователя или пароль")
    
    # Create session
    session = await create_session(db=db, user_id=user.id)
    
    # Detect HTTPS dynamically (supports reverse proxies & plain IP access)
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_id",
        value=session.id,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )
    
    return AuthResponse(
        id=user.id,
        username=user.username,
        role=user.role
    )


@router.get("/me", response_model=AuthResponse)
async def get_current_user_profile(
    user: User = Depends(get_current_user)
):
    """Get current authenticated user profile"""
    return AuthResponse(
        id=user.id,
        username=user.username,
        role=user.role
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
    
    return {"message": "Успешный выход"}
