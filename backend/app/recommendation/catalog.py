"""Incremental snapshot sync; removals become visible only after a full scan."""
import asyncio
from datetime import datetime, timedelta
import logging
from sqlalchemy import select, update, delete, func
from sqlalchemy.dialects.sqlite import insert
from app.database import AsyncSessionLocal
from app.recommendation.models import (CatalogTrack, CatalogArtist, CatalogAlbum, TrackArtist,
    ArtistEdge, Genre, GenreFamily, GenreAlias, TrackGenre, CatalogMeta)
from app.recommendation.genres import normalize_genres, normalize_year, ALIAS_VERSION
from app.recommendation.artists import artists_for

log = logging.getLogger(__name__)


async def upsert(db, model, rows, keys):
    if not rows:
        return
    # Bound parameter count even on older SQLite builds.
    width = len(rows[0])
    for start in range(0, len(rows), max(1, 900 // width)):
        stmt = insert(model).values(rows[start:start + max(1, 900 // width)])
        stmt = stmt.on_conflict_do_update(index_elements=keys,
            set_={key: getattr(stmt.excluded, key) for key in rows[0] if key not in keys})
        await db.execute(stmt)


async def meta(db, key, value):
    if key == 'sync':
        previous = await db.get(CatalogMeta, key)
        if previous and previous.value.get('synced_at') and 'synced_at' not in value:
            value = {**value, 'synced_at': previous.value['synced_at']}
    await upsert(db, CatalogMeta, [dict(key=key, value=value, updated_at=datetime.utcnow())], ['key'])


async def index_page(db, songs, seen_at):
    tracks, artists, albums, memberships, genres, families, tags, aliases = {}, {}, {}, [], {}, {}, [], {}
    # Resolve fallback names to known server identities before creating synthetic IDs.
    names = {a['normalized_name'] for song in songs for a in artists_for(song)}
    known = (await db.scalars(select(CatalogArtist).where(CatalogArtist.normalized_name.in_(names)))).all() if names else []
    by_name = {a.normalized_name: a.id for a in sorted(known, key=lambda a: not a.is_synthetic)}
    remote_ids = {a.id: a.navidrome_id for a in known}
    canonical_ids = {a.navidrome_id: a.id for a in known if a.navidrome_id}
    for song in songs:
        if not song.get('id'):
            continue
        track_id = str(song['id'])
        credits = artists_for(song)
        for credit in credits:
            existing_id = canonical_ids.get(credit['navidrome_id']) or by_name.get(credit['normalized_name'])
            existing_remote = remote_ids.get(existing_id)
            if existing_id and (credit['is_synthetic'] or not existing_remote or existing_remote == credit['navidrome_id']):
                credit['id'] = existing_id
            else:
                by_name[credit['normalized_name']] = credit['id']
            artist_id = credit['id']
            if credit['navidrome_id']:
                remote_ids[artist_id] = credit['navidrome_id']
                canonical_ids[credit['navidrome_id']] = artist_id
            # Do not replace an existing real artist with a fallback synthetic record.
            if not credit['is_synthetic'] or not remote_ids.get(artist_id):
                artists[artist_id] = {k: credit[k] for k in ('id', 'name', 'normalized_name', 'navidrome_id', 'is_synthetic')}
            memberships.append(dict(track_id=track_id, artist_id=artist_id, role=credit['role'], position=credit['position'], weight=credit['weight']))
        normalized = normalize_genres(song)
        for genre in normalized:
            family_id, genre_id = genre['family'], genre['slug']
            families[family_id] = dict(id=family_id, slug=family_id, display_name=family_id.title())
            genres[genre_id] = dict(id=genre_id, slug=genre_id, display_name=genre['name'], family_id=family_id, is_unknown=genre['is_unknown'])
            tags.append(dict(track_id=track_id, genre_id=genre_id, raw_tag=genre['raw_tag'], weight=1 / len(normalized)))
            aliases[genre['alias']] = dict(alias=genre['alias'], genre_id=genre_id, confidence=genre['confidence'], source='fuzzy' if genre['confidence'] == .8 else 'seed', updated_at=seen_at)
        album_id = str(song.get('albumId') or '')
        year = normalize_year(song)
        if album_id:
            albums[album_id] = dict(id=album_id, name=song.get('album', ''), artist_id=credits[0]['id'], artist_name=song.get('artist', ''), year=year, last_seen_at=seen_at)
        tracks[track_id] = dict(id=track_id, title=song.get('title', ''), artist_name=song.get('artist', ''),
            primary_artist_id=credits[0]['id'], album_id=album_id, album_name=song.get('album', ''),
            cover_art=song.get('coverArt'), duration=song.get('duration') or 0, year=year,
            release_date=str(song.get('releaseDate')) if song.get('releaseDate') else None,
            raw_genre=song.get('genre'), raw_genres=song.get('genres') or [song.get('genre', '')],
            raw_moods=song.get('moods') or [], bpm=song.get('bpm'), added_at=song.get('created'),
            is_active=True, last_seen_at=seen_at, payload=song,
            artist_ids=list(dict.fromkeys(a['id'] for a in credits)), genre_ids=[g['slug'] for g in normalized],
            family_ids=list(dict.fromkeys(g['family'] for g in normalized)))
    for model, rows, keys in ((CatalogArtist, artists.values(), ['id']), (CatalogAlbum, albums.values(), ['id']),
            (GenreFamily, families.values(), ['id']), (Genre, genres.values(), ['id']),
            (GenreAlias, aliases.values(), ['alias']), (CatalogTrack, tracks.values(), ['id'])):
        await upsert(db, model, list(rows), keys)
    if tracks:
        await db.execute(delete(TrackArtist).where(TrackArtist.track_id.in_(tracks)))
        await db.execute(delete(TrackGenre).where(TrackGenre.track_id.in_(tracks)))
    await upsert(db, TrackArtist, list({(r['track_id'], r['artist_id']): r for r in memberships}.values()), ['track_id', 'artist_id'])
    await upsert(db, TrackGenre, tags, ['track_id', 'genre_id'])


async def rebuild_edges(db):
    # Aggregate in SQL: no full catalog graph in Python memory.
    from sqlalchemy.orm import aliased
    a, b = aliased(TrackArtist), aliased(TrackArtist)
    rows = (await db.execute(select(a.artist_id, b.artist_id, func.count())
        .join(b, a.track_id == b.track_id).join(CatalogTrack, CatalogTrack.id == a.track_id)
        .where(a.artist_id != b.artist_id, CatalogTrack.is_active.is_(True))
        .group_by(a.artist_id, b.artist_id))).all()
    await db.execute(delete(ArtistEdge))
    await upsert(db, ArtistEdge, [dict(artist_id=a, related_artist_id=b, co_track_count=n, weight=min(1, n / 3)) for a, b, n in rows], ['artist_id', 'related_artist_id'])


async def sync_catalog(client, session_factory=AsyncSessionLocal):
    started = datetime.utcnow()
    offset = 0
    try:
        async with session_factory() as db:
            await meta(db, 'sync', dict(status='syncing', progress=0))
            await db.commit()
        while True:
            response = await client.get('search3.view', query='', songCount=500, songOffset=offset, artistCount=0, albumCount=0)
            songs = response.get('searchResult3', {}).get('song', [])
            if not songs:
                break
            async with session_factory() as db:
                await index_page(db, songs, started)
                await meta(db, 'sync', dict(status='syncing', progress=offset + len(songs)))
                await db.commit()
            offset += len(songs)
            if len(songs) < 500:
                break
            await asyncio.sleep(.01)
        async with session_factory() as db:
            await db.execute(update(CatalogTrack).where(CatalogTrack.last_seen_at < started).values(is_active=False))
            await rebuild_edges(db)
            await meta(db, 'sync', dict(status='ready', progress=offset, synced_at=datetime.utcnow().isoformat()))
            await meta(db, 'alias_version', ALIAS_VERSION)
            await db.commit()
    except asyncio.CancelledError:
        raise
    except Exception:
        # Never publish upstream URLs/auth parameters in logs or the status API.
        log.warning('Synapse catalog sync failed; existing catalog retained')
        async with session_factory() as db:
            await meta(db, 'sync', dict(status='unavailable', progress=offset))
            await db.commit()
        return False
    return True


async def renormalize_catalog(session_factory=AsyncSessionLocal):
    """Apply new aliases to stored raw metadata even while Navidrome is offline."""
    cursor = ''
    while True:
        async with session_factory() as db:
            rows = (await db.scalars(select(CatalogTrack).where(CatalogTrack.id > cursor).order_by(CatalogTrack.id).limit(500))).all()
            if not rows:
                await meta(db, 'alias_version', ALIAS_VERSION)
                await db.commit()
                break
            cursor = rows[-1].id
            originals = [(r.id, r.last_seen_at, r.is_active) for r in rows]
            await index_page(db, [r.payload for r in rows], datetime.utcnow())
            for track_id, last_seen, active in originals:
                await db.execute(update(CatalogTrack).where(CatalogTrack.id == track_id).values(last_seen_at=last_seen, is_active=active))
            await db.commit()


async def sync_loop(client):
    while True:
        async with AsyncSessionLocal() as db:
            sync = await db.get(CatalogMeta, 'sync')
            aliases = await db.get(CatalogMeta, 'alias_version')
            empty = not await db.scalar(select(CatalogTrack.id).where(CatalogTrack.is_active.is_(True)).limit(1))
            stale = empty or not sync or sync.updated_at < datetime.utcnow() - timedelta(hours=6)
            changed = not aliases or aliases.value != ALIAS_VERSION
        if changed:
            await renormalize_catalog()
        if stale or changed or (sync and sync.value.get('status') != 'ready'):
            await sync_catalog(client)
        await asyncio.sleep(6 * 3600)
