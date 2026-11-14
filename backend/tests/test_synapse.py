import os
os.environ.setdefault('SECRET_KEY', 'synapse-test')
os.environ.setdefault('ENCRYPTION_KEY', 'synapse-test')
import unittest
from app.recommendation.genres import normalize_genres, normalize_year
from app.recommendation.learning import classify, predict, train, PRIORS


class NormalizationTests(unittest.TestCase):
    def test_aliases_compounds_and_unknown(self):
        self.assertEqual(normalize_genres({'genre': 'D&B'})[0]['slug'], 'drum-and-bass')
        self.assertEqual(normalize_genres({'genre': 'Рок; R&B'})[1]['slug'], 'rnb')
        self.assertEqual(normalize_genres({'genre': 'РОК'})[0]['family'], 'rock')
        self.assertTrue(normalize_genres({'genre': 'Martian opera'})[0]['is_unknown'])
        self.assertEqual(normalize_genres({'genres': [{'name': 'lo-fi'}, {'name': 'джаз'}]})[0]['slug'], 'lo-fi')

    def test_year_precedence(self):
        self.assertEqual(normalize_year({'originalDate': {'year': 1981}, 'year': 2000}), 1981)
        self.assertEqual(normalize_year({'releaseDate': '1995-01-01'}), 1995)
        self.assertIsNone(normalize_year({'year': 1800}))

    def test_labels_and_training(self):
        self.assertEqual(classify('skip', 5, 200), ('strong', 0))
        self.assertEqual(classify('skip', 70, 200), ('neutral', None))
        self.assertEqual(classify('skip', 175, 200), ('positive', 1))
        weights = dict(PRIORS)
        before = predict(weights, -1, {'bridge': 1})
        weights, bias = train(weights, -1, {'bridge': 1}, 1, 0)
        self.assertGreater(predict(weights, bias, {'bridge': 1}), before)

from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func
from fastapi import HTTPException
from app.database import Base
from app.models import Favorite
from app.recommendation.catalog import index_page, meta, sync_catalog, renormalize_catalog, rebuild_edges
from app.recommendation.models import (CatalogTrack, CatalogArtist, Taste, TrackState, Cooldown,
    RecommendationState, MoodTaste, SynapseSession, SessionTrack, ListeningEvent, ArtistEdge)
from app.recommendation.service import make_mix, refill, reset_profile, status
from app.recommendation.signals import process_events
from app.recommendation.schemas import PlaybackEvent


def song(n, artist=None, genre='rock', album=None, **extra):
    a = artist or f'artist{n}'
    return dict(id=str(n), title=f'Track {n}', artist=a, artistId=a,
        albumId=album or f'album{n}', album=album or f'Album {n}', duration=200,
        genre=genre, year=2000, suffix='mp3', **extra)


def event(track, mix, kind='complete', played=200, **extra):
    return PlaybackEvent(id=uuid4(), session_id=mix, track_id=str(track), event_type=kind,
        position_seconds=played, duration_seconds=200, context={'played_seconds': played}, **extra)


class SynapseIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine('sqlite+aiosqlite:///:memory:')
        self.factory = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.db = self.factory()
        await index_page(self.db, [song(i) for i in range(1, 31)], datetime.utcnow())
        await meta(self.db, 'sync', {'status': 'ready', 'synced_at': datetime.utcnow().isoformat()})
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        await self.engine.dispose()

    async def favorite(self, item, kind='track', user='u1'):
        self.db.add(Favorite(user_id=user, item_id=str(item), item_type=kind))
        await self.db.commit()

    async def mix(self, filters=None, mood=None, limit=20, user='u1'):
        return await make_mix(self.db, user, filters or ['familiar', 'unfamiliar'], mood, limit)

    async def test_favorite_only_no_filler_and_exact_exclusion(self):
        await self.favorite(1)
        mix = await self.mix(['favorites'])
        self.assertEqual([t['id'] for t in mix['tracks']], ['1'])
        self.assertIn('Знакомое', mix['hint'])
        ordinary = await self.mix()
        self.assertNotIn('1', [t['id'] for t in ordinary['tracks']])
        unfamiliar = await self.mix(['unfamiliar'])
        self.assertTrue(all(t['artistId'] != 'artist1' for t in unfamiliar['tracks']))
        # Favorite artist's non-favorite album sibling stays familiar.
        await index_page(self.db, [song(31, artist='artist1')], datetime.utcnow())
        await self.db.commit()
        familiar = await self.mix(['familiar'])
        self.assertEqual([t['id'] for t in familiar['tracks']], ['31'])

    async def test_favorite_album_and_soft_mood(self):
        await self.favorite('album1', 'album')
        mix = await self.mix(['favorites'], 'sad')
        self.assertEqual([t['id'] for t in mix['tracks']], ['1'])
        self.assertIn('любимого альбома', mix['tracks'][0]['synapse']['reason'])

    async def test_learning_idempotent_mood_and_profile_scope(self):
        mix = await self.mix(mood='sad')
        track = mix['tracks'][0]['id']
        feedback = event(track, mix['mix_id'])
        await process_events(self.db, 'u1', [feedback, feedback])
        state = await self.db.get(TrackState, ('u1', track))
        self.assertEqual(state.plays, 1)
        self.assertEqual(state.completions, 1)
        self.assertGreater((await self.db.get(Taste, ('u1', 'track', track))).score, 0)
        self.assertGreater((await self.db.get(MoodTaste, ('u1', 'sad', 'track', track))).score, 0)
        await self.favorite(track)
        other = await self.mix(user='u2')
        await process_events(self.db, 'u2', [event(other['tracks'][0]['id'], other['mix_id'])])
        await reset_profile(self.db, 'u1')
        self.assertIsNone(await self.db.get(RecommendationState, 'u1'))
        self.assertIsNotNone(await self.db.get(RecommendationState, 'u2'))
        self.assertIsNotNone(await self.db.scalar(select(Favorite).where(Favorite.user_id == 'u1')))

    async def test_scoping_and_unexposed_event(self):
        mix = await self.mix(limit=1)
        with self.assertRaises(HTTPException) as caught:
            await refill(self.db, 'other', mix['mix_id'], 15, [])
        self.assertEqual(caught.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            await process_events(self.db, 'u1', [event('unexposed', mix['mix_id'])])
        await self.db.rollback()
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(ListeningEvent)), 0)

    async def test_refill_excludes_exposures_and_queue(self):
        mix = await self.mix(limit=10)
        follow = await refill(self.db, 'u1', mix['mix_id'], 15, ['30'])
        ids = {t['id'] for t in mix['tracks']}
        self.assertTrue(ids.isdisjoint(t['id'] for t in follow['tracks']))
        self.assertNotIn('30', {t['id'] for t in follow['tracks']})
        self.assertEqual(len(follow['tracks']), 15)

    async def test_strong_skip_cooldowns_and_mood_protection(self):
        mix = await self.mix(mood='sad', limit=1)
        track = mix['tracks'][0]
        await process_events(self.db, 'u1', [event(track['id'], mix['mix_id'], 'skip', 5)])
        self.assertAlmostEqual((await self.db.get(Taste, ('u1', 'track', track['id']))).score, -.75)
        self.assertAlmostEqual((await self.db.get(MoodTaste, ('u1', 'sad', 'track', track['id']))).score, -1.5)
        self.assertIsNotNone(await self.db.get(Cooldown, ('u1', 'artist', track['artistId'])))
        self.assertLess((await self.db.get(RecommendationState, 'u1')).exploration_ratio, .25)
        other = await self.mix()
        self.assertNotIn(track['id'], {t['id'] for t in other['tracks']})

    async def test_normally_liked_evaluated_before_current_skip(self):
        mix = await self.mix(limit=1)
        track = mix['tracks'][0]
        self.db.add(TrackState(user_id='u1', track_id=track['id'], plays=3, completions=2, skips=1, avg_completion=.7))
        await self.db.commit()
        await process_events(self.db, 'u1', [event(track['id'], mix['mix_id'], 'skip', 5)])
        self.assertIsNone(await self.db.get(Cooldown, ('u1', 'artist', track['artistId'])))
        self.assertIsNotNone(await self.db.get(Cooldown, ('u1', 'album', track['albumId'])))

    async def test_neutral_skip_and_weak_skip(self):
        mix = await self.mix(limit=2)
        a, b = mix['tracks']
        await process_events(self.db, 'u1', [event(a['id'], mix['mix_id'], 'skip', 80), event(b['id'], mix['mix_id'], 'skip', 30)])
        self.assertIsNone(await self.db.get(Taste, ('u1', 'track', a['id'])))
        self.assertLess((await self.db.get(Taste, ('u1', 'track', b['id']))).score, 0)
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(Cooldown)), 0)

    async def test_favorite_event_trains_mood_without_play_or_general_signal(self):
        mix = await self.mix(mood='productive', limit=1)
        track = mix['tracks'][0]['id']
        await self.favorite(track)
        await process_events(self.db, 'u1', [event(track, mix['mix_id'], 'favorite', 0)])
        self.assertIsNone(await self.db.get(TrackState, ('u1', track)))
        self.assertIsNone(await self.db.get(Taste, ('u1', 'track', track)))
        self.assertGreater((await self.db.get(MoodTaste, ('u1', 'productive', 'track', track))).score, 0)

    async def test_artist_fallback_identity_and_collaboration(self):
        first = song(41)
        first.pop('artistId')
        first['artist'] = 'Sample Artist'
        await index_page(self.db, [first], datetime.utcnow())
        second = song(42, artists=[{'id':'remote-a', 'name':'Sample Artist'}, {'id':'remote-b', 'name':'Guest'}])
        await index_page(self.db, [second], datetime.utcnow())
        await rebuild_edges(self.db)
        await self.db.commit()
        one, two = await self.db.get(CatalogTrack, '41'), await self.db.get(CatalogTrack, '42')
        self.assertEqual(one.primary_artist_id, two.primary_artist_id)
        artist = await self.db.get(CatalogArtist, one.primary_artist_id)
        self.assertEqual(artist.navidrome_id, 'remote-a')
        self.assertFalse(artist.is_synthetic)
        self.assertIsNotNone(await self.db.get(ArtistEdge, (one.primary_artist_id, 'remote-b')))

    async def test_sync_failure_preserves_active_snapshot(self):
        class FailingClient:
            async def get(self, *a, **kw):
                raise RuntimeError('offline')
        self.assertFalse(await sync_catalog(FailingClient(), self.factory))
        self.db.expire_all()
        self.assertEqual(await self.db.scalar(select(func.count()).select_from(CatalogTrack).where(CatalogTrack.is_active.is_(True))), 30)
        self.assertEqual((await status(self.db, 'u1'))['status'], 'ready')

    async def test_completed_sync_marks_missing_only_after_success(self):
        class Client:
            async def get(self, *a, **kw):
                return {'searchResult3': {'song': [song(1)]}}
        self.assertTrue(await sync_catalog(Client(), self.factory))
        self.db.expire_all()
        self.assertFalse((await self.db.get(CatalogTrack, '2')).is_active)
        self.assertTrue((await self.db.get(CatalogTrack, '1')).is_active)

    async def test_syncing_filters_not_overridden_by_favorites(self):
        await self.favorite(1)
        from app.recommendation.models import CatalogMeta
        row = await self.db.get(CatalogMeta, 'sync')
        row.value = {'status': 'syncing', 'progress': 30}
        await self.db.commit()
        mix = await self.mix(['unfamiliar'])
        self.assertEqual(mix['tracks'], [])
        mix = await self.mix(['favorites'])
        self.assertEqual([t['id'] for t in mix['tracks']], ['1'])

    async def test_alias_reresolution_keeps_active_flags(self):
        from app.recommendation.models import CatalogMeta
        t = await self.db.get(CatalogTrack, '2')
        t.genre_ids = ['obsolete']
        t.is_active = False
        await self.db.commit()
        await renormalize_catalog(self.factory)
        self.db.expire_all()
        t = await self.db.get(CatalogTrack, '2')
        self.assertEqual(t.genre_ids, ['rock'])
        self.assertFalse(t.is_active)

    async def test_remote_artists_with_same_name_remain_distinct(self):
        await index_page(self.db, [song(41, artists=[{'id': 'john-a', 'name': 'John Williams'}])], datetime.utcnow())
        await index_page(self.db, [song(42, artists=[{'id': 'john-b', 'name': 'John Williams'}])], datetime.utcnow())
        await self.db.commit()
        one, two = await self.db.get(CatalogTrack, '41'), await self.db.get(CatalogTrack, '42')
        self.assertNotEqual(one.primary_artist_id, two.primary_artist_id)
        fallback = song(43)
        fallback.pop('artistId')
        fallback['artist'] = 'John Williams'
        await index_page(self.db, [fallback], datetime.utcnow())
        await index_page(self.db, [song(44, artists=[{'id': 'john-a', 'name': 'John Williams'}])], datetime.utcnow())
        await self.db.commit()
        self.assertEqual(one.primary_artist_id, (await self.db.get(CatalogTrack, '44')).primary_artist_id)
        self.assertIsNotNone((await self.db.get(CatalogArtist, two.primary_artist_id)).navidrome_id)


    async def test_repeated_distinct_skips_escalate_liked_artist(self):
        await index_page(self.db, [song(i, artist='artist-liked') for i in range(41, 44)], datetime.utcnow())
        await self.db.commit()
        await self.favorite(41)
        for track_id, expected in [(42, 0), (43, 7)]:
            mix = await self.mix(['familiar'])
            self.assertIn(str(track_id), {t['id'] for t in mix['tracks']})
            await process_events(self.db, 'u1', [event(track_id, mix['mix_id'], 'skip', 5)])
            cooldown = await self.db.get(Cooldown, ('u1', 'artist', 'artist-liked'))
            if expected:
                self.assertGreater(cooldown.until, datetime.utcnow() + timedelta(days=expected - .1))
            else:
                self.assertIsNone(cooldown)


class ExplorationTests(unittest.TestCase):
    def test_rates_are_independent_of_pool_volume_and_bounded(self):
        from app.recommendation.signals import adapt_exploration
        familiar = [({'skip_kind': 'positive'}, {'unfamiliar': 0})] * 75
        unfamiliar = [({'skip_kind': 'positive'}, {'unfamiliar': 1})] * 25
        self.assertEqual(adapt_exploration(.25, familiar + unfamiliar), .25)
        skips = [({'skip_kind': 'strong'}, {'unfamiliar': 1})] * 25
        self.assertAlmostEqual(adapt_exploration(.25, familiar + skips), .23)
        self.assertEqual(adapt_exploration(.1, familiar + skips), .1)
        self.assertEqual(adapt_exploration(.45, [({'skip_kind': 'strong'}, {'unfamiliar': 0})] + unfamiliar), .45)

from fastapi import FastAPI
import httpx
from app.database import get_db
from app.models import User, Session as AuthSession
from app.recommendation.router import router


class SynapseHTTPTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await SynapseIntegrationTests.asyncSetUp(self)
        for user_id in ['u1', 'u2']:
            self.db.add(User(id=user_id, username=user_id, password_hash='test-only'))
            self.db.add(AuthSession(id='token-' + user_id, user_id=user_id,
                expires_at=datetime.utcnow() + timedelta(days=1)))
        await self.db.commit()
        app = FastAPI()
        app.include_router(router, prefix='/api')
        async def db_override():
            async with self.factory() as db:
                yield db
        app.dependency_overrides[get_db] = db_override
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test')

    async def asyncTearDown(self):
        await self.client.aclose()
        await SynapseIntegrationTests.asyncTearDown(self)

    async def test_http_auth_validation_scoping_and_idempotency(self):
        for method, url, body in [('GET', '/mix', None), ('GET', '/status', None), ('DELETE', '/profile', None),
                ('POST', '/events', {'events': []}), ('POST', '/mix', {}), ('POST', '/sessions/not-mine/refill', {'limit':15})]:
            response = await self.client.request(method, '/api/synapse' + url, json=body)
            self.assertEqual(response.status_code, 401, response.text)
        self.client.cookies.set('session_id', 'token-u1')
        for query in ['mood=invalid', 'limit=51', 'familiarity=invalid']:
            self.assertEqual((await self.client.get('/api/synapse/mix?' + query)).status_code, 422)
        many = [str(n) for n in range(1, 1501)]
        excluded = await self.client.post('/api/synapse/mix', json={
            'familiarity': ['familiar', 'unfamiliar'], 'mood': None,
            'limit': 15, 'exclude_track_ids': many})
        self.assertEqual(excluded.status_code, 200, excluded.text)
        self.assertEqual(excluded.json()['tracks'], [])
        mix = (await self.client.get('/api/synapse/mix?limit=2&exclude_track_ids=30')).json()
        self.assertEqual(len(mix['tracks']), 2)
        feedback = event(mix['tracks'][0]['id'], mix['mix_id'])
        body = {'events': [feedback.model_dump(mode='json')] * 2}
        self.assertEqual((await self.client.post('/api/synapse/events', json=body)).status_code, 204)
        self.db.expire_all()
        state = await self.db.get(TrackState, ('u1', feedback.track_id))
        self.assertEqual(state.plays, 1)
        self.client.cookies.set('session_id', 'token-u2')
        self.assertEqual((await self.client.post('/api/synapse/events', json=body)).status_code, 404)
        self.assertEqual((await self.client.post(f"/api/synapse/sessions/{mix['mix_id']}/refill", json={})).status_code, 404)
        await SynapseIntegrationTests.favorite(self, feedback.track_id)
        self.client.cookies.set('session_id', 'token-u1')
        self.assertEqual((await self.client.delete('/api/synapse/profile')).status_code, 204)
        self.db.expire_all()
        self.assertIsNotNone(await self.db.scalar(select(Favorite).where(Favorite.user_id == 'u1')))
        self.assertIsNone(await self.db.get(RecommendationState, 'u1'))


class DiversityTests(unittest.TestCase):
    def test_weighted_clusters_represent_weak_tastes_and_keep_hard_caps(self):
        from collections import Counter
        from types import SimpleNamespace
        from app.recommendation.engine import diversify
        rows = []
        taste = {}
        for family, weight in [('rock', .9), ('jazz', .6), ('classical', .3), ('metal', .15), ('electronic', .1)]:
            taste[('family', family)] = SimpleNamespace(entity_type='family', score=weight, confidence=1, updated_at=datetime.utcnow())
            for n in range(20):
                track = SimpleNamespace(id=family+str(n), artist_ids=[family+str(n)], album_id=family+str(n), family_ids=[family], year=2000)
                rows.append(dict(track=track, features={'family': weight}, score=weight, known=True))
        selected = diversify(rows, 20, .25, ['familiar'], taste)
        counts = Counter(f for row in selected for f in row['track'].family_ids)
        self.assertEqual(len(selected), 20)
        self.assertTrue(all(2 <= counts[f] <= 5 for f in taste_family_names(taste)))
        self.assertGreaterEqual(counts['rock'], counts['electronic'])

    def test_exploration_quota_does_not_override_hard_artist_cap(self):
        from collections import Counter
        from types import SimpleNamespace
        from app.recommendation.engine import diversify
        rows = []
        for n in range(60):
            unknown = n < 10
            track = SimpleNamespace(id=str(n), artist_ids=['unknown' if unknown else str(n)], album_id=str(n), family_ids=['genre'+str(n%5)], year=2000)
            rows.append(dict(track=track, features={}, score=1 if unknown else .9, known=not unknown))
        selected = diversify(rows, 20, .25, ['familiar', 'unfamiliar'], {})
        counts = Counter(a for row in selected for a in row['track'].artist_ids)
        self.assertEqual(len(selected), 20)
        self.assertLessEqual(counts['unknown'], 2)


def taste_family_names(taste):
    return [name for kind, name in taste if kind == 'family']
