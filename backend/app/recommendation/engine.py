"""Bounded local candidate pools and diversified per-user logistic ranking."""
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
import json
import math
from sqlalchemy import select, func, or_, and_
from app.models import Favorite
from app.recommendation.models import (CatalogTrack, TrackArtist, TrackGenre, Genre, ArtistEdge,
    Taste, TrackState, MoodTaste, Cooldown, RecommendationState, SessionTrack)
from app.recommendation.learning import PRIORS, predict, affinity, decay

MOODS = json.loads((Path(__file__).parent / 'data/mood_priors.json').read_text())


async def anchors(db, user_id):
    favorites = (await db.scalars(select(Favorite).where(Favorite.user_id == user_id))).all()
    track_ids = {f.item_id for f in favorites if f.item_type == 'track'}
    album_ids = {f.item_id for f in favorites if f.item_type == 'album'}
    rows = (await db.scalars(select(CatalogTrack).where(or_(CatalogTrack.id.in_(track_ids), CatalogTrack.album_id.in_(album_ids))))).all() if favorites else []
    artists = {a for t in rows for a in t.artist_ids}
    genres = {g for t in rows for g in t.genre_ids}
    families = {f for t in rows for f in t.family_ids}
    years = [t.year for t in rows if t.year]
    return track_ids, album_ids, artists, genres, families, years


def mood_score(track, mood, learned):
    if not mood:
        return 0
    raw = [str(m.get('name', '') if isinstance(m, dict) else m).casefold() for m in track.raw_moods]
    names = {'sad': ['sad', 'melancholic', 'грустный'], 'productive': ['productive', 'focus', 'focused', 'спокойный'], 'upbeat': ['upbeat', 'happy', 'energetic', 'энергичный']}
    prior = max([MOODS[mood].get(g, .5) for g in track.genre_ids + track.family_ids] or [.5])
    if any(tag in names[mood] for tag in raw):
        prior = .95
    if track.bpm:
        prior += .05 if (mood == 'upbeat' and track.bpm >= 120) or (mood == 'sad' and track.bpm < 90) else 0
    entities = [('track', track.id)] + [('artist', a) for a in track.artist_ids] + [('genre', g) for g in track.genre_ids] + [('family', f) for f in track.family_ids]
    observed = [math.tanh(decay(learned[e].score, learned[e].updated_at, 45)) for e in entities if e in learned]
    return max(0, min(1, prior + .3 * sum(observed) / max(1, len(observed))))


async def recommend(db, user_id, filters, mood, limit, excluded=(), session_id=None, favorites_fallback=False):
    favorites, favorite_albums, favorite_artists, anchor_genres, anchor_families, years = await anchors(db, user_id)
    taste_rows = (await db.scalars(select(Taste).where(Taste.user_id == user_id))).all()
    taste = {(r.entity_type, r.entity_id): r for r in taste_rows}
    positive_artists = {r.entity_id for r in taste_rows if r.entity_type == 'artist' and affinity(r) > 0}
    known = favorite_artists | positive_artists
    learned_albums = {r.entity_id for r in taste_rows if r.entity_type == 'album' and affinity(r) > 0}
    learned_families = {r.entity_id for r in taste_rows if r.entity_type == 'family' and affinity(r) > 0}
    learned_eras = {int(r.entity_id) for r in taste_rows if r.entity_type == 'era' and affinity(r) > 0 and r.entity_id.isdigit()}
    years += [era + 5 for era in learned_eras]
    positive_genres = anchor_genres | {r.entity_id for r in taste_rows if r.entity_type == 'genre' and affinity(r) > 0}
    known_track = CatalogTrack.id.in_(select(TrackArtist.track_id).where(TrackArtist.artist_id.in_(known)))
    exact_favorite = CatalogTrack.id.in_(favorites)
    favorite_pool = or_(exact_favorite, CatalogTrack.album_id.in_(favorite_albums))
    familiar_pool = known_track
    allowed = []
    if 'familiar' in filters:
        allowed.append(familiar_pool)
    if 'unfamiliar' in filters:
        allowed.append(~known_track)
    if 'favorites' in filters:
        allowed.append(favorite_pool)
    if not allowed:
        return []
    eligibility = True if 'familiar' in filters and 'unfamiliar' in filters else or_(*allowed)
    where = [CatalogTrack.is_active.is_(True), eligibility]
    if favorites_fallback:
        where.append(favorite_pool)
    if 'favorites' not in filters:
        where.append(~exact_favorite)
    excluded = set(excluded)
    if session_id:
        excluded.update((await db.scalars(select(SessionTrack.track_id).where(SessionTrack.session_id == session_id))).all())
    if excluded:
        excluded_values = func.json_each(json.dumps(list(excluded))).table_valued('value')
        where.append(~CatalogTrack.id.in_(select(excluded_values.c.value)))
    cooldowns = (await db.scalars(select(Cooldown).where(Cooldown.user_id == user_id, Cooldown.until > datetime.utcnow()))).all()
    bans = {(r.entity_type, r.entity_id) for r in cooldowns}
    recent_rows = (await db.scalars(select(TrackState).where(TrackState.user_id == user_id).order_by(TrackState.last_played_at.desc()).limit(50))).all()
    recent = {r.track_id for r in recent_rows}
    recent_tracks = (await db.scalars(select(CatalogTrack).where(CatalogTrack.id.in_([r.track_id for r in recent_rows[:5]])))).all()
    recent_artists = {a for t in recent_tracks for a in t.artist_ids}
    recent_albums = {t.album_id for t in recent_tracks if t.album_id}
    recent.update((await db.scalars(select(TrackState.track_id).where(TrackState.user_id == user_id, TrackState.last_played_at > datetime.utcnow() - timedelta(hours=24)))).all())
    state = await db.get(RecommendationState, user_id)
    weights, bias = (state.feature_weights or PRIORS, state.bias) if state else (PRIORS, -1)
    ratio = state.exploration_ratio if state else .25
    learned_mood = {(r.entity_type, r.entity_id): r for r in (await db.scalars(select(MoodTaste).where(MoodTaste.user_id == user_id, MoodTaste.mood == mood))).all()} if mood else {}
    bridges = {r.related_artist_id: r.weight for r in (await db.scalars(select(ArtistEdge).where(ArtistEdge.artist_id.in_(known)))).all()}
    # Each query is capped before ORM hydration. Multiple pools protect weaker taste clusters.
    pools = []
    if 'favorites' in filters:
        pools.append((favorite_pool, 250, False, None))
    if 'familiar' in filters:
        pools.append((familiar_pool, 350, False, select(TrackArtist.track_id.label('candidate_id')).where(TrackArtist.artist_id.in_(known))))
    if bridges:
        pools.append((CatalogTrack.primary_artist_id.in_(bridges), 150, False, select(TrackArtist.track_id.label('candidate_id')).where(TrackArtist.artist_id.in_(bridges))))
    top_genres = sorted(positive_genres, key=lambda g: affinity(taste.get(('genre', g))) + (g in anchor_genres), reverse=True)[:5]
    for genre in top_genres:
        pools.append((True, 100, False, select(TrackGenre.track_id.label('candidate_id')).where(TrackGenre.genre_id == genre)))
    if learned_albums:
        pools.append((CatalogTrack.album_id.in_(learned_albums), 100, False, None))
    if learned_families:
        pools.append((True, 150, False, select(TrackGenre.track_id.label('candidate_id')).join(Genre, Genre.id == TrackGenre.genre_id).where(Genre.family_id.in_(learned_families), ~Genre.id.in_(top_genres))))
    if learned_eras:
        pools.append((or_(*(and_(CatalogTrack.year >= era, CatalogTrack.year < era + 10) for era in learned_eras)), 100, False, None))
    pools.append((True, 100, True, None))  # new arrivals
    pools.append((True, 350, False, None))  # wildcard / cold-start exploration
    ids = set()
    for pool_index, (condition, count, newest, source) in enumerate(pools):
        if pool_index < len(pools) - 1:
            count = min(count, max(0, (650 - len(ids)) // (len(pools) - pool_index - 1)))
        if not count:
            continue
        statement = select(CatalogTrack.id)
        if source is not None:
            # Materialize a bounded, index-filtered sample before joining the wide
            # catalog. An unbounded IN subquery makes SQLite scan all active rows.
            sample = source.order_by(func.random()).limit(count * 4).subquery()
            statement = statement.join(sample, sample.c.candidate_id == CatalogTrack.id)
        statement = statement.where(*where, condition)
        statement = statement.order_by(CatalogTrack.added_at.desc() if newest else func.random()).limit(max(0, min(count, (1000 if pool_index == len(pools) - 1 else 650) - len(ids))))
        ids.update((await db.scalars(statement)).all())
        if len(ids) >= 1000:
            break
    tracks = (await db.scalars(select(CatalogTrack).where(CatalogTrack.id.in_(ids)))).all() if ids else []
    all_exposures = sum(r.exposures for r in taste_rows if r.entity_type == 'artist')
    artist_stats = {}
    stats_rows = (await db.execute(select(CatalogTrack.primary_artist_id, func.sum(TrackState.plays), func.sum(TrackState.completions))
        .join(TrackState, TrackState.track_id == CatalogTrack.id).where(TrackState.user_id == user_id).group_by(CatalogTrack.primary_artist_id))).all()
    for artist, plays, completed in stats_rows:
        artist_stats[artist] = completed / max(1, plays)
    scored = []
    for track in tracks:
        is_known = any(a in known for a in track.artist_ids)
        is_favorite = track.id in favorites
        favorite_album = track.album_id in favorite_albums
        artist_rows = [taste.get(('artist', a)) for a in track.artist_ids]
        exposures = sum(r.exposures for r in artist_rows if r)
        a_score = max([affinity(r) * (1 if i == 0 else .6) for i, r in enumerate(artist_rows)] or [0])
        features = dict(favorite_track=float(is_favorite), favorite_album=float(favorite_album), favorite_artist=float(any(a in favorite_artists for a in track.artist_ids)),
            artist=a_score, album=affinity(taste.get(('album', track.album_id))),
            genre=max([affinity(taste.get(('genre', g))) + (.5 if g in anchor_genres else 0) for g in track.genre_ids] or [0]),
            family=max([affinity(taste.get(('family', f))) + (.3 if f in anchor_families else 0) for f in track.family_ids] or [0]),
            era=affinity(taste.get(('era', str(track.year // 10 * 10)))) if track.year else 0,
            year=max([math.exp(-abs(track.year-y)/15) for y in years] or [0]) if track.year else 0,
            bridge=max([bridges.get(a, 0) for a in track.artist_ids] or [0]), mood=mood_score(track, mood, learned_mood),
            completion=artist_stats.get(track.primary_artist_id, 0), unfamiliar=float(not is_known),
            novelty=math.sqrt(math.log(all_exposures + 1) / (exposures + 1)), fatigue=float(track.id in recent), recent_artist=float(bool(set(track.artist_ids) & recent_artists)), recent_album=float(track.album_id in recent_albums))
        score = predict(weights, bias, features) + .5 * features['novelty']
        if is_favorite:
            channel, reason = 'favorites', 'Ваш любимый трек'
        elif favorite_album:
            channel, reason = 'favorite_album', 'Из любимого альбома'
        elif features['favorite_artist']:
            channel, reason = 'favorite_artist', f'Потому что вам нравится {track.artist_name}'
        elif not is_known and features['bridge']:
            channel, reason = 'bridge_artist', 'Новый исполнитель через знакомые коллаборации'
        elif is_known:
            channel, reason = 'artist_affinity', 'На основе ваших прослушиваний Synapse'
        elif features['genre'] > 0:
            channel, reason = 'genre_affinity', 'Рядом с вашими любимыми жанрами'
        else:
            channel, reason = 'wildcard', 'Новое открытие из вашей медиатеки'
        if mood and features['mood'] >= .7:
            reason = 'Под настроение: ' + {'sad': 'Грустное', 'productive': 'Продуктивное', 'upbeat': 'Бодрое'}[mood]
        entities = {('track', track.id), ('album', track.album_id)} | {('artist', a) for a in track.artist_ids}
        scored.append(dict(track=track, features=features, score=score, channel=channel, reason=reason, known=is_known,
            banned=bool(entities & bans), recent=track.id in recent))
    # Relax recency before cooldowns, never eligibility or session/queue exclusions.
    for relax in range(3):
        available = [r for r in scored if (relax == 2 or not r['banned']) and (relax >= 1 or not r['recent'])]
        if len(available) >= limit or relax == 2:
            break
    return diversify(available, limit, ratio, filters, taste)


def diversify(rows, limit, ratio, filters, taste):
    selected, artists, albums, families = [], Counter(), Counter(), Counter()
    selected_eras = set()
    unfamiliar_target = round(limit * ratio) if 'familiar' in filters and 'unfamiliar' in filters else None
    clusters = Counter()
    availability = Counter()
    for row in rows:
        for family in row['track'].family_ids:
            availability[family] += 1
            weight = max(0, affinity(taste.get(('family', family)))) + .2 * max(0, row['features'].get('family', 0))
            clusters[family] = max(clusters[family], weight)
    active = [f for f, weight in clusters.most_common(5) if weight > 0]
    # Cold start has no positive clusters: evenly explore available families.
    if not active:
        active = [f for f, _ in availability.most_common(5)]
    quotas = {f: min(availability[f], 2, limit // max(1, len(active))) for f in active}
    # After guaranteeing two slots, distribute the remainder proportionally.
    while quotas and sum(quotas.values()) < limit:
        eligible = [f for f in active if quotas[f] < min(availability[f], max(1, math.ceil(limit / 4)))]
        if not eligible:
            break
        best = max(eligible, key=lambda f: (clusters[f] or 1) / (quotas[f] + 1))
        quotas[best] += 1
    artist_cap, family_cap = max(1, math.ceil(limit / 10)), max(1, math.ceil(limit / 4))
    while rows and len(selected) < limit:
        remaining = limit - len(selected)
        unknown_selected = sum(not r['known'] for r in selected)
        want_unknown = unfamiliar_target is not None and unknown_selected < unfamiliar_target and remaining <= unfamiliar_target - unknown_selected
        need_family = {f for f, count in quotas.items() if families[f] < count}
        family_pressure = sum(max(0, quotas[f]-families[f]) for f in quotas) >= remaining
        candidates = rows
        if want_unknown and any(not r['known'] for r in candidates):
            candidates = [r for r in candidates if not r['known']]
        elif unfamiliar_target is not None and unknown_selected >= unfamiliar_target and any(r['known'] for r in candidates):
            candidates = [r for r in candidates if r['known']]
        if family_pressure and any(set(r['track'].family_ids) & need_family for r in candidates):
            candidates = [r for r in candidates if set(r['track'].family_ids) & need_family]
        capped = [r for r in candidates if all(artists[a] < artist_cap for a in r['track'].artist_ids)
            and (not r['track'].album_id or albums[r['track'].album_id] < artist_cap)
            and all(families[f] < family_cap for f in r['track'].family_ids)]
        if not capped:
            capped = [r for r in rows if all(artists[a] < artist_cap for a in r['track'].artist_ids)
                and (not r['track'].album_id or albums[r['track'].album_id] < artist_cap)
                and all(families[f] < family_cap for f in r['track'].family_ids)]
        if capped:
            candidates = capped
        def value(row):
            track = row['track']
            similarity = (1 if any(artists[a] for a in track.artist_ids) else
                .8 if track.album_id and albums[track.album_id] else
                .5 if any(families[f] for f in track.family_ids) else
                .2 if track.year and track.year // 10 in selected_eras else 0)
            cluster_bonus = .08 * sum(families[f] < quotas.get(f, 0) for f in track.family_ids)
            return row['score'] - .25 * similarity + cluster_bonus
        best = max(candidates, key=value)
        selected.append(best)
        rows.remove(best)
        artists.update(best['track'].artist_ids)
        albums.update([best['track'].album_id])
        families.update(best['track'].family_ids)
        if best['track'].year:
            selected_eras.add(best['track'].year // 10)
    return selected
