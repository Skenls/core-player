from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from datetime import datetime
import asyncio
from app.database import get_db
from app.dependencies import require_admin
from app.models import User
from app.auth import hash_password


router = APIRouter(prefix="/admin", tags=["admin"])


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4)
    role: str = Field(default="user")  # "admin" | "user"


class UpdateUserRequest(BaseModel):
    role: str | None = None
    password: str | None = None


@router.get("/users", response_model=list[UserOut])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all registered users (Admin only)"""
    result = await db.execute(select(User).order_by(User.created_at.asc()))
    users = result.scalars().all()
    return [
        UserOut(
            id=u.id,
            username=u.username,
            role=u.role,
            created_at=u.created_at
        )
        for u in users
    ]


@router.post("/users", response_model=UserOut)
async def create_user(
    req: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (Admin only)"""
    # Check if username exists
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    role = req.role if req.role in ["admin", "user"] else "user"
    password_hash = await asyncio.to_thread(hash_password, req.password)
    new_user = User(
        username=req.username,
        password_hash=password_hash,
        role=role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return UserOut(
        id=new_user.id,
        username=new_user.username,
        role=new_user.role,
        created_at=new_user.created_at
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user (Admin only)"""
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить собственную учетную запись")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user_to_delete = result.scalar_one_or_none()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # If deleting an admin, ensure at least one other admin remains
    if user_to_delete.role == "admin":
        count_admins = await db.execute(select(func.count(User.id)).where(User.role == "admin"))
        if (count_admins.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Нельзя удалить последнего администратора")
    
    await db.delete(user_to_delete)
    await db.commit()
    
    return {"message": "Пользователь успешно удален"}


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    req: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update user role or password (Admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user_to_update = result.scalar_one_or_none()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if req.role and req.role in ["admin", "user"]:
        # Don't demote self if only 1 admin
        if user_to_update.id == admin.id and req.role != "admin":
            raise HTTPException(status_code=400, detail="Нельзя снять права администратора с себя")
        user_to_update.role = req.role
        
    if req.password:
        user_to_update.password_hash = await asyncio.to_thread(hash_password, req.password)
        
    await db.commit()
    await db.refresh(user_to_update)
    
    return UserOut(
        id=user_to_update.id,
        username=user_to_update.username,
        role=user_to_update.role,
        created_at=user_to_update.created_at
    )
