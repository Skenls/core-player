from datetime import datetime
from collections import Counter
from uuid import uuid4
from sqlalchemy import select, delete, func
from sqlalchemy.dialects.sqlite import insert
from fastapi import HTTPException
from app.recommendation.models import (CatalogMeta, CatalogTrack, CatalogArtist, Genre,
    SynapseSession, SessionTrack, ListeningEvent, Taste, TrackState, MoodTaste, Cooldown, RecommendationState)
from app.recommendation.engine import recommend
from app.recommendation.learning import affinity


async def catalog_status(db):
    row = await db.get(CatalogMeta, 'sync')
    count = await db.scalar(select(func.count()).select_from(CatalogTrack).where(CatalogTrack.is_active.is_(True)))
    values = dict(row.value) if row else {'status': 'syncing', 'progress': 0}
    # A completed snapshot remains usable if a later refresh fails.
    values['status'] = 'ready' if count and values.get('synced_at') else values.get('status', 'syncing')
    values['catalog_tracks'] = count
    return values


async def make_mix(db, user_id, familiarity, mood, limit, exclude=(), session=None):
    status = await catalog_status(db)
    if session is None:
        session = SynapseSession(id=str(uuid4()), user_id=user_id,
            filters={'familiarity': familiarity, 'mood': mood}, mood=mood)
        db.add(session)
        await db.flush()
    else:
        familiarity = session.filters['familiarity']
        mood = session.mood
        session.last_refill_at = datetime.utcnow()
    rows = await recommend(db, user_id, familiarity, mood, limit, exclude, session.id, favorites_fallback=status['status'] != 'ready')
    position = (await db.scalar(select(func.max(SessionTrack.position)).where(SessionTrack.session_id == session.id)))
    position = 0 if position is None else position + 1
    tracks = []
    exposures = Counter()
    for offset, row in enumerate(rows):
        track = row['track']
        db.add(SessionTrack(session_id=session.id, position=position+offset, track_id=track.id,
            channel=row['channel'], reason=row['reason'], score=row['score'], features=row['features']))
        for artist in track.artist_ids:
            exposures[('artist', artist)] += 1
        for genre in track.genre_ids:
            exposures[('genre', genre)] += 1
        tracks.append({**track.payload, 'synapse': dict(session_id=session.id,
            reason=row['reason'], channel=row['channel'], score=round(row['score'], 5))})
    if exposures:
        stmt = insert(Taste).values([dict(user_id=user_id, entity_type=kind, entity_id=entity, score=0, confidence=0, exposures=count, updated_at=datetime.utcnow()) for (kind, entity), count in exposures.items()])
        await db.execute(stmt.on_conflict_do_update(index_elements=['user_id', 'entity_type', 'entity_id'], set_={'exposures': Taste.exposures + stmt.excluded.exposures}))
    await db.commit()
    return dict(mix_id=session.id, status=status['status'], catalog_synced_at=status.get('synced_at'),
        filters={'familiarity': familiarity, 'mood': mood}, tracks=tracks,
        hint='Добавьте «Знакомое», чтобы расширить подборку' if familiarity == ['favorites'] and len(tracks) < limit else None)


async def refill(db, user_id, session_id, limit, exclude):
    session = await db.get(SynapseSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(404, 'Synapse session not found')
    return await make_mix(db, user_id, session.filters['familiarity'], session.mood, limit, exclude, session)


async def status(db, user_id):
    result = await catalog_status(db)
    state = await db.get(RecommendationState, user_id)
    result.update(total_events=state.total_events if state else 0,
                  exploration_ratio=state.exploration_ratio if state else .25)
    tastes = (await db.scalars(select(Taste).where(Taste.user_id == user_id))).all()
    result['top_genres'], result['top_artists'] = [], []
    for kind, model, field in [('genre', Genre, 'top_genres'), ('artist', CatalogArtist, 'top_artists')]:
        top = sorted([r for r in tastes if r.entity_type == kind and affinity(r) > 0], key=affinity, reverse=True)[:5]
        for row in top:
            entity = await db.get(model, row.entity_id)
            result[field].append(dict(id=row.entity_id, name=(entity.display_name if kind == 'genre' else entity.name) if entity else row.entity_id, score=affinity(row)))
    last = await db.scalar(select(func.max(SynapseSession.created_at)).where(SynapseSession.user_id == user_id))
    result['last_mix_at'] = last.isoformat() if last else None
    return result


async def reset_profile(db, user_id):
    session_ids = select(SynapseSession.id).where(SynapseSession.user_id == user_id)
    await db.execute(delete(SessionTrack).where(SessionTrack.session_id.in_(session_ids)))
    for model in (ListeningEvent, SynapseSession, Taste, TrackState, MoodTaste, Cooldown, RecommendationState):
        await db.execute(delete(model).where(model.user_id == user_id))
    await db.commit()
