import asyncio
from weakref import WeakValueDictionary
from typing import Literal
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.recommendation.schemas import EventBatch, RefillRequest, MixRequest
from app.recommendation import service
from app.recommendation.signals import process_events

router = APIRouter(prefix='/synapse', tags=['Synapse'])
# SQLite is the persistent source of truth; locks serialize a user's concurrent
# refills/events/reset within this single-process application.
_locks = WeakValueDictionary()


def user_lock(user_id):
    lock = _locks.get(user_id)
    if lock is None:
        lock = asyncio.Lock()
        _locks[user_id] = lock
    return lock


@router.get('/mix')
async def mix(familiarity: str = Query(default='familiar,unfamiliar', max_length=100),
              mood: Literal['sad', 'productive', 'upbeat'] | None = None,
              limit: int = Query(default=20, ge=1, le=50),
              exclude_track_ids: str = Query(default='', max_length=256000),
              user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    filters = list(dict.fromkeys(x.strip() for x in familiarity.split(',') if x.strip()))
    if not filters or any(x not in ('familiar', 'unfamiliar', 'favorites') for x in filters):
        raise HTTPException(422, 'Select familiar, unfamiliar or favorites')
    excluded = [x for x in exclude_track_ids.split(',') if x]
    if len(excluded) > 1000:
        raise HTTPException(422, 'Too many excluded tracks')
    async with user_lock(user.id):
        return await service.make_mix(db, user.id, filters, mood, limit, excluded)


@router.post('/mix')
async def create_mix(body: MixRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    async with user_lock(user.id):
        return await service.make_mix(db, user.id, list(dict.fromkeys(body.familiarity)), body.mood, body.limit, body.exclude_track_ids)


@router.post('/sessions/{mix_id}/refill')
async def refill(mix_id: str, body: RefillRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    async with user_lock(user.id):
        return await service.refill(db, user.id, mix_id, body.limit, body.exclude_track_ids)


@router.post('/events', status_code=204)
async def events(body: EventBatch, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    async with user_lock(user.id):
        await process_events(db, user.id, body.events)
    return Response(status_code=204)


@router.get('/status')
async def status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.status(db, user.id)


@router.delete('/profile', status_code=204)
async def reset(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    async with user_lock(user.id):
        await service.reset_profile(db, user.id)
    return Response(status_code=204)
