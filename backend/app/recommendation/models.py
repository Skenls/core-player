from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Boolean, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class CatalogTrack(Base):
    __tablename__ = 'catalog_tracks'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, default='')
    artist_name: Mapped[str] = mapped_column(String, default='')
    primary_artist_id: Mapped[str] = mapped_column(String, index=True)
    album_id: Mapped[str] = mapped_column(String, index=True)
    album_name: Mapped[str] = mapped_column(String, default='')
    cover_art: Mapped[str | None] = mapped_column(String)
    duration: Mapped[float] = mapped_column(Float, default=0)
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    release_date: Mapped[str | None] = mapped_column(String)
    raw_genre: Mapped[str | None] = mapped_column(String)
    raw_genres: Mapped[list] = mapped_column(JSON, default=list)
    raw_moods: Mapped[list] = mapped_column(JSON, default=list)
    bpm: Mapped[float | None] = mapped_column(Float)
    added_at: Mapped[str | None] = mapped_column(String, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    # Preserve Subsonic fields for the existing player; no stream API adapter.
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    artist_ids: Mapped[list] = mapped_column(JSON, default=list)
    genre_ids: Mapped[list] = mapped_column(JSON, default=list)
    family_ids: Mapped[list] = mapped_column(JSON, default=list)
    __table_args__ = (Index('ix_catalog_active_added', 'is_active', 'added_at'),)


class CatalogArtist(Base):
    __tablename__ = 'catalog_artists'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    normalized_name: Mapped[str] = mapped_column(String, index=True)
    navidrome_id: Mapped[str | None] = mapped_column(String)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)


class CatalogAlbum(Base):
    __tablename__ = 'catalog_albums'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    artist_id: Mapped[str] = mapped_column(String, index=True)
    artist_name: Mapped[str] = mapped_column(String)
    year: Mapped[int | None] = mapped_column(Integer)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime)


class TrackArtist(Base):
    __tablename__ = 'catalog_track_artists'
    track_id: Mapped[str] = mapped_column(String, primary_key=True)
    artist_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String, default='primary')
    position: Mapped[int] = mapped_column(Integer, default=0)
    weight: Mapped[float] = mapped_column(Float, default=1)


class ArtistEdge(Base):
    __tablename__ = 'catalog_artist_edges'
    artist_id: Mapped[str] = mapped_column(String, primary_key=True)
    related_artist_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    co_track_count: Mapped[int] = mapped_column(Integer, default=1)
    weight: Mapped[float] = mapped_column(Float, default=1)


class GenreFamily(Base):
    __tablename__ = 'catalog_genre_families'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    slug: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String)


class Genre(Base):
    __tablename__ = 'catalog_genres'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    slug: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String)
    family_id: Mapped[str] = mapped_column(String, index=True)
    is_unknown: Mapped[bool] = mapped_column(Boolean, default=False)


class GenreAlias(Base):
    __tablename__ = 'catalog_genre_aliases'
    alias: Mapped[str] = mapped_column(String, primary_key=True)
    genre_id: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float, default=1)
    source: Mapped[str] = mapped_column(String, default='seed')
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TrackGenre(Base):
    __tablename__ = 'catalog_track_genres'
    track_id: Mapped[str] = mapped_column(String, primary_key=True)
    genre_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    raw_tag: Mapped[str] = mapped_column(String)
    weight: Mapped[float] = mapped_column(Float, default=1)


class CatalogMeta(Base):
    __tablename__ = 'catalog_meta'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Taste(Base):
    __tablename__ = 'user_taste'
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, primary_key=True)
    entity_id: Mapped[str] = mapped_column(String, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    exposures: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TrackState(Base):
    __tablename__ = 'user_track_state'
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    track_id: Mapped[str] = mapped_column(String, primary_key=True)
    plays: Mapped[int] = mapped_column(Integer, default=0)
    completions: Mapped[int] = mapped_column(Integer, default=0)
    skips: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    last_skipped_at: Mapped[datetime | None] = mapped_column(DateTime)
    avg_completion: Mapped[float] = mapped_column(Float, default=0)


class MoodTaste(Base):
    __tablename__ = 'user_mood_taste'
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    mood: Mapped[str] = mapped_column(String, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, primary_key=True)
    entity_id: Mapped[str] = mapped_column(String, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    observations: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Cooldown(Base):
    __tablename__ = 'user_cooldowns'
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, primary_key=True)
    entity_id: Mapped[str] = mapped_column(String, primary_key=True)
    until: Mapped[datetime] = mapped_column(DateTime)
    severity: Mapped[str] = mapped_column(String, default='strong')
    reason: Mapped[str] = mapped_column(String, default='early_skip')
    source_mix_id: Mapped[str] = mapped_column(String)


class RecommendationState(Base):
    __tablename__ = 'user_recommendation_state'
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    feature_weights: Mapped[dict] = mapped_column(JSON, default=dict)
    bias: Mapped[float] = mapped_column(Float, default=-1)
    exploration_ratio: Mapped[float] = mapped_column(Float, default=.25)
    familiar_ratio: Mapped[float] = mapped_column(Float, default=.75)
    model_version: Mapped[int] = mapped_column(Integer, default=1)
    total_events: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SynapseSession(Base):
    __tablename__ = 'synapse_sessions'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    filters: Mapped[dict] = mapped_column(JSON)
    mood: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_refill_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String, default='active')


class SessionTrack(Base):
    __tablename__ = 'synapse_session_tracks'
    session_id: Mapped[str] = mapped_column(String, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    track_id: Mapped[str] = mapped_column(String, index=True)
    channel: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(String)
    score: Mapped[float] = mapped_column(Float)
    features: Mapped[dict] = mapped_column(JSON)
    exposed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index('ix_synapse_exposure_track', 'session_id', 'track_id', unique=True),)


class ListeningEvent(Base):
    __tablename__ = 'listening_events'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    track_id: Mapped[str] = mapped_column(String)
    primary_artist_id: Mapped[str] = mapped_column(String, index=True)
    album_id: Mapped[str] = mapped_column(String)
    genre_ids: Mapped[list] = mapped_column(JSON, default=list)
    event_type: Mapped[str] = mapped_column(String)
    position_seconds: Mapped[float] = mapped_column(Float)
    duration_seconds: Mapped[float] = mapped_column(Float)
    percent: Mapped[float] = mapped_column(Float)
    mood: Mapped[str | None] = mapped_column(String)
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    client_ts: Mapped[str | None] = mapped_column(String)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
