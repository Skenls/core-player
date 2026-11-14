"""Only authenticated Synapse exposures can update the learned profile."""
from datetime import datetime, timedelta
import math
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert
from app.models import Favorite
from app.recommendation.models import (CatalogTrack, SynapseSession, SessionTrack, ListeningEvent,
    Taste, TrackState, MoodTaste, Cooldown, RecommendationState)
from app.recommendation.engine import anchors
from app.recommendation.learning import PRIORS, classify, affinity, decay, train, taste_half_life


async def add_taste(db, user_id, entity_type, entity_id, signal=0, exposure=0):
    if not entity_id:
        return
    row = await db.get(Taste, (user_id, entity_type, entity_id))
    if not row:
        row = Taste(user_id=user_id, entity_type=entity_type, entity_id=entity_id, score=0,
                    confidence=0, exposures=0, updated_at=datetime.utcnow())
        db.add(row)
    row.score = decay(row.score, row.updated_at, taste_half_life(entity_type, row.score)) + signal
    row.confidence = min(1, row.confidence + (.15 if signal else 0))
    row.exposures += exposure
    row.updated_at = datetime.utcnow()


async def add_mood(db, user_id, mood, kind, entity_id, signal):
    row = await db.get(MoodTaste, (user_id, mood, kind, entity_id))
    if not row:
        row = MoodTaste(user_id=user_id, mood=mood, entity_type=kind, entity_id=entity_id,
                        score=0, observations=0, updated_at=datetime.utcnow())
        db.add(row)
    row.score = decay(row.score, row.updated_at, 45) + signal
    row.observations += 1
    row.updated_at = datetime.utcnow()


async def apply_cooldowns(db, user_id, track, session_id, liked):
    previous = (await db.scalars(select(ListeningEvent).where(ListeningEvent.user_id == user_id,
        ListeningEvent.primary_artist_id == track.primary_artist_id, ListeningEvent.received_at > datetime.utcnow() - timedelta(days=7),
        ListeningEvent.event_type == 'skip'))).all()
    early = {e.track_id for e in previous if e.context.get('skip_kind') == 'strong'} | {track.id}
    artist_days = 14 if len(early) >= 3 else 7 if len(early) >= 2 else 0 if liked else 3
    bans = [('track', track.id, 3 if liked else 14), ('album', track.album_id, 3 if liked else 7)]
    if artist_days:
        bans.append(('artist', track.primary_artist_id, artist_days))
    for kind, entity_id, days in bans:
        if not entity_id:
            continue
        row = await db.get(Cooldown, (user_id, kind, entity_id))
        until = datetime.utcnow() + timedelta(days=days)
        if row:
            row.until = max(row.until, until)
            row.source_mix_id = session_id
        else:
            db.add(Cooldown(user_id=user_id, entity_type=kind, entity_id=entity_id, until=until, source_mix_id=session_id))


async def process_events(db, user_id, events):
    for event in events:
        session = await db.get(SynapseSession, event.session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(404, 'Synapse session not found')
        exposure = await db.scalar(select(SessionTrack).where(SessionTrack.session_id == session.id, SessionTrack.track_id == event.track_id))
        track = await db.get(CatalogTrack, event.track_id)
        if not exposure or not track:
            raise HTTPException(422, 'Track was not exposed in this Synapse session')
        if event.event_type == 'favorite' and not await db.scalar(select(Favorite.id).where(Favorite.user_id == user_id, Favorite.item_id == track.id, Favorite.item_type == 'track')):
            raise HTTPException(422, 'Favorite anchor does not exist')
        duration = track.duration or event.duration_seconds
        raw_played = event.context.get('played_seconds', event.position_seconds)
        if not isinstance(raw_played, (float, int)) or isinstance(raw_played, bool) or not math.isfinite(raw_played) or raw_played < 0:
            raise HTTPException(422, 'Invalid played seconds')
        played = min(float(raw_played), duration) if duration > 0 else float(raw_played)
        kind, label = classify(event.event_type, played, duration)
        context = {'played_seconds': played, 'skip_kind': kind, 'ended': event.event_type == 'complete'}
        values = dict(id=str(event.id), user_id=user_id, session_id=session.id, track_id=track.id,
            primary_artist_id=track.primary_artist_id, album_id=track.album_id, genre_ids=track.genre_ids,
            event_type=event.event_type, position_seconds=event.position_seconds, duration_seconds=duration,
            percent=played / duration if duration else 0, mood=session.mood, context=context,
            client_ts=event.client_ts, received_at=datetime.utcnow())
        inserted = await db.scalar(insert(ListeningEvent).values(**values).on_conflict_do_nothing(index_elements=['id']).returning(ListeningEvent.id))
        if not inserted or event.event_type == 'start':
            continue
        if kind == 'strong':
            _, _, favorite_artists, _, _, _ = await anchors(db, user_id)
            artist_tastes = (await db.scalars(select(Taste).where(Taste.user_id == user_id, Taste.entity_type == 'artist'))).all()
            positive = sorted(affinity(r) for r in artist_tastes if affinity(r) > 0)
            row = next((r for r in artist_tastes if r.entity_id == track.primary_artist_id), None)
            liked = track.primary_artist_id in favorite_artists or bool(row and row.confidence >= .45 and positive and affinity(row) >= positive[int((len(positive)-1)*.75)])
            stats = (await db.execute(select(func.sum(TrackState.plays), func.sum(TrackState.completions))
                .join(CatalogTrack, CatalogTrack.id == TrackState.track_id)
                .where(TrackState.user_id == user_id, CatalogTrack.primary_artist_id == track.primary_artist_id))).one()
            liked = liked or bool(stats[0] and stats[0] >= 3 and stats[1] / stats[0] >= .6)
        if event.event_type != 'favorite':
            state = await db.get(TrackState, (user_id, track.id))
            if not state:
                state = TrackState(user_id=user_id, track_id=track.id, plays=0, completions=0, skips=0, avg_completion=0)
                db.add(state)
            state.avg_completion = (state.avg_completion * state.plays + (played / duration if duration else 0)) / (state.plays + 1)
            state.plays += 1
            state.last_played_at = datetime.utcnow()
            if label == 1:
                state.completions += 1
            else:
                state.skips += 1
                state.last_skipped_at = datetime.utcnow()
        model = await db.get(RecommendationState, user_id)
        if not model:
            model = RecommendationState(user_id=user_id, feature_weights=dict(PRIORS), bias=-1, exploration_ratio=.25, familiar_ratio=.75, total_events=0)
            db.add(model)
        if label == 1:
            weights = dict(track=1, artist=.7, album=.4, genre=.5, family=.3, era=.2)
        elif kind in ('strong', 'weak'):
            scale = 1 if kind == 'strong' else .5
            weights = {k: v * scale for k, v in dict(track=-1.5, artist=-.6, album=-.8, genre=-.2, family=-.1).items()}
        else:
            weights = {}
        entities = [('track', track.id, 1), ('album', track.album_id, 1)]
        entities += [('artist', a, 1 if i == 0 else .6) for i, a in enumerate(track.artist_ids)]
        entities += [('genre', g, 1 / max(1, len(track.genre_ids))) for g in track.genre_ids]
        entities += [('family', f, 1 / max(1, len(track.family_ids))) for f in track.family_ids]
        if track.year:
            entities.append(('era', str(track.year // 10 * 10), 1))
        for entity_type, entity_id, multiplier in entities:
            if entity_id and entity_type in weights:
                signal = weights[entity_type] * multiplier
                protection = .5 if session.mood and signal < 0 and entity_type in ('track', 'artist') else 1
                if event.event_type != 'favorite':
                    await add_taste(db, user_id, entity_type, entity_id, signal * protection)
                if session.mood:
                    await add_mood(db, user_id, session.mood, entity_type, entity_id, signal)
        if kind == 'strong':
            await apply_cooldowns(db, user_id, track, session.id, liked)
        if label is not None:
            model.feature_weights, model.bias = train(model.feature_weights, model.bias, exposure.features, label, model.total_events)
            if 'familiar' in session.filters['familiarity'] and 'unfamiliar' in session.filters['familiarity']:
                samples = (await db.execute(select(ListeningEvent.context, SessionTrack.features)
                    .join(SessionTrack, (SessionTrack.session_id == ListeningEvent.session_id) & (SessionTrack.track_id == ListeningEvent.track_id))
                    .where(ListeningEvent.user_id == user_id, ListeningEvent.event_type != 'start')
                    .order_by(ListeningEvent.received_at.desc()).limit(200))).all()
                model.exploration_ratio = adapt_exploration(model.exploration_ratio, samples)
                model.familiar_ratio = 1 - model.exploration_ratio
        model.total_events += 1
        model.updated_at = datetime.utcnow()
    await db.commit()


def adapt_exploration(ratio, samples):
    pools = {True: [], False: []}
    for context, features in samples:
        kind = context.get('skip_kind')
        if kind in ('positive', 'strong'):
            pools[bool(features.get('unfamiliar'))].append(kind == 'positive')
    if not pools[True]:
        return ratio
    unknown = sum(pools[True]) / len(pools[True])
    familiar = sum(pools[False]) / len(pools[False]) if pools[False] else .5
    change = .02 if unknown > familiar else -.02 if unknown < familiar else 0
    return max(.1, min(.45, ratio + change))
