"""Opt-in reproducible 100k-track benchmark; never touches the application DB.
Run from repository root: PYTHONPATH=backend backend/venv/bin/python backend/tests/benchmark_synapse.py
"""
import os
os.environ.setdefault('SECRET_KEY', 'benchmark-only')
os.environ.setdefault('ENCRYPTION_KEY', 'benchmark-only')
import asyncio
from datetime import datetime
from statistics import median
from time import perf_counter
from sqlalchemy import insert, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base
from app.models import Favorite
from app.recommendation.catalog import index_page, meta
from app.recommendation.models import CatalogTrack, TrackArtist, TrackGenre, Taste
from app.recommendation.service import make_mix


async def main():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    sql_times = []
    @event.listens_for(engine.sync_engine, 'before_cursor_execute')
    def before_sql(conn, cursor, statement, parameters, context, many):
        context.synapse_start = perf_counter()
    @event.listens_for(engine.sync_engine, 'after_cursor_execute')
    def after_sql(conn, cursor, statement, parameters, context, many):
        sql_times.append(((perf_counter() - context.synapse_start) * 1000, statement))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    families = ['rock', 'electronic', 'classical', 'jazz', 'metal']
    now = datetime.utcnow()
    async with factory() as db:
        for f in families:
            await index_page(db, [dict(id='seed-' + f, title=f, artist=f, artistId=f,
                albumId=f, genre=f, duration=200)], now)
        for start in range(0, 100000, 5000):
            rows, artists, genres = [], [], []
            for n in range(start, start + 5000):
                f, artist = families[n % 5], 'artist-' + str(n % 1000)
                track_id = str(n)
                payload = dict(id=track_id, title='Track ' + track_id, artist=artist, artistId=artist,
                    albumId='album-' + str(n // 10), album='Album', duration=200, year=1970 + n % 55, suffix='mp3', genre=f)
                rows.append(dict(id=track_id, title=payload['title'], artist_name=artist,
                    primary_artist_id=artist, album_id=payload['albumId'], album_name='Album', duration=200,
                    year=payload['year'], raw_genres=[f], raw_moods=[], is_active=True,
                    last_seen_at=now, added_at='2025-01-01', payload=payload,
                    artist_ids=[artist], genre_ids=[f], family_ids=[f]))
                artists.append(dict(track_id=track_id, artist_id=artist, role='primary', position=0, weight=1))
                genres.append(dict(track_id=track_id, genre_id=f, raw_tag=f, weight=1))
            await db.execute(insert(CatalogTrack), rows)
            await db.execute(insert(TrackArtist), artists)
            await db.execute(insert(TrackGenre), genres)
        await meta(db, 'sync', {'status':'ready', 'synced_at':now.isoformat()})
        # Eclectic profile with different weights across five clusters.
        for i, f in enumerate(families):
            db.add(Taste(user_id='bench', entity_type='family', entity_id=f,
                         score=2-i*.3, confidence=.9, exposures=20))
            db.add(Taste(user_id='bench', entity_type='genre', entity_id=f,
                         score=2-i*.3, confidence=.9, exposures=20))
        for n in range(30):
            db.add(Favorite(user_id='bench', item_id=str(n), item_type='track'))
        await db.commit()
        timings = []
        for n in range(6):
            sql_times.clear()
            before = perf_counter()
            mix = await make_mix(db, 'bench', ['familiar', 'unfamiliar'], None, 20)
            elapsed = (perf_counter() - before) * 1000
            assert len(mix['tracks']) == 20
            assert len({t['id'] for t in mix['tracks']}) == 20
            timings.append(elapsed)
        if os.getenv('SYNAPSE_SQL_PROFILE'):
            for ms, sql in sorted(sql_times, reverse=True)[:12]:
                print(f'{ms:.1f}ms {sql[:400]}')
        print('100k catalog mix ms:', ', '.join(f'{x:.1f}' for x in timings))
        print(f'Warm median: {median(timings[1:]):.1f}ms; target <200ms')
    await engine.dispose()


if __name__ == '__main__':
    asyncio.run(main())
