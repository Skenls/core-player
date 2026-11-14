import type { Track } from './subsonic';

export type Familiarity = 'familiar' | 'unfamiliar' | 'favorites';
export type Mood = 'sad' | 'productive' | 'upbeat' | null;
export interface SynapseFilters {
  familiarity: Familiarity[];
  mood: Mood | null;
}
export interface SynapseMetadata {
  session_id: string;
  reason: string;
  channel: string;
  score: number;
}
export type SynapseTrack = Track & { synapse: SynapseMetadata };
export interface SynapseMix {
  mix_id: string;
  status: string;
  catalog_synced_at: string | null;
  filters: SynapseFilters;
  tracks: SynapseTrack[];
  hint?: string | null;
}
export interface SynapseStatus {
  status: string;
  track_count?: number;
  event_count?: number;
  exploration_ratio?: number;
  [key: string]: unknown;
}
export interface SynapseEvent {
  id: string;
  session_id: string;
  track_id: string;
  event_type: 'start' | 'complete' | 'skip' | 'favorite';
  position_seconds: number;
  duration_seconds: number;
  percent: number;
  client_ts: string;
  context: { played_seconds: number; skip_kind?: 'strong' | 'weak' | 'neutral'; ended?: boolean };
}
export function isSynapseTrack(track: Track | null): track is SynapseTrack {
  return !!track && 'synapse' in track && !!track.synapse;
}
