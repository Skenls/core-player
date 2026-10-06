import type { Track } from './subsonic';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  queueIndex: number;
  originalQueue: Track[];
  shuffle: boolean;
  repeat: RepeatMode;
  seekRequestedTime: number | null;
}

export interface QueueItem extends Track {
  queueId: string; // Unique ID for drag-and-drop
}
