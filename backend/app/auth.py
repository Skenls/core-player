import hashlib
import secrets
from cryptography.fernet import Fernet
from app.config import settings
from app.models import Session
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


# Initialize Fernet cipher
cipher = Fernet(settings.encryption_key.encode() if len(settings.encryption_key) == 44 else Fernet.generate_key())


def generate_salt() -> str:
    """Generate random salt for Subsonic auth"""
    return secrets.token_hex(8)


def generate_subsonic_token(password: str, salt: str) -> str:
    """Generate Subsonic token: MD5(password + salt)"""
    return hashlib.md5(f"{password}{salt}".encode()).hexdigest()


def encrypt_value(value: str) -> str:
    """Encrypt a value using Fernet"""
    return cipher.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    """Decrypt a value using Fernet"""
    return cipher.decrypt(encrypted.encode()).decode()


async def create_session(
    db: AsyncSession,
    navidrome_url: str,
    username: str,
    password: str,
) -> Session:
    """
    Create a new session with encrypted credentials
    """
    # Generate salt and token
    salt = generate_salt()
    token = generate_subsonic_token(password, salt)
    
    # Encrypt sensitive data
    encrypted_url = encrypt_value(navidrome_url)
    encrypted_username = encrypt_value(username)
    
    # Create session
    session = Session(
        user_id=username,  # Use username as user_id
        navidrome_url=encrypted_url,
        username=encrypted_username,
        subsonic_token=token,
        salt=salt,
        expires_at=datetime.utcnow() + timedelta(days=settings.session_expire_days)
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    return session


async def get_session_by_id(db: AsyncSession, session_id: str) -> Session | None:
    """Get session by ID"""
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if session and session.is_expired():
        await db.delete(session)
        await db.commit()
        return None
    
    return session


async def delete_session(db: AsyncSession, session_id: str) -> bool:
    """Delete a session"""
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if session:
        await db.delete(session)
        await db.commit()
        return True
    
    return False
