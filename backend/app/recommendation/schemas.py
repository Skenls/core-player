from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class RefillRequest(BaseModel):
    limit: int = Field(default=15, ge=1, le=50)
    exclude_track_ids: list[str] = Field(default_factory=list, max_length=100000)


class PlaybackEvent(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: UUID
    session_id: str = Field(max_length=100)
    track_id: str = Field(max_length=255)
    event_type: Literal['start', 'complete', 'skip', 'favorite']
    position_seconds: float = Field(default=0, ge=0, le=604800)
    duration_seconds: float = Field(default=0, ge=0, le=604800)
    percent: float = Field(default=0, ge=0, le=1)
    client_ts: str | None = Field(default=None, max_length=100)
    context: dict = Field(default_factory=dict)


class EventBatch(BaseModel):
    events: list[PlaybackEvent] = Field(max_length=100)


class MixRequest(RefillRequest):
    familiarity: list[Literal['familiar', 'unfamiliar', 'favorites']] = Field(default_factory=lambda: ['familiar', 'unfamiliar'], min_length=1, max_length=3)
    mood: Literal['sad', 'productive', 'upbeat'] | None = None
