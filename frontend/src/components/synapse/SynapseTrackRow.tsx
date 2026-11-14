import { Music2, Play, Pause } from 'lucide-react';
import type { SynapseTrack } from '@/types/synapse';
import { cleanArtistName } from '@/lib/formatters';

export function SynapseTrackRow({ track, index, active, playing, onPlay }: {
  track: SynapseTrack; index: number; active: boolean; playing: boolean; onPlay: () => void;
}) {
  return <button type="button" className={`synapse-track ${active ? 'is-current' : ''}`} onClick={onPlay}
    aria-label={`${active && playing ? 'Пауза' : 'Воспроизвести'}: ${track.title}, ${cleanArtistName(track.artist)}. ${track.synapse.reason}`} aria-current={active ? 'true' : undefined}>
    <span className="synapse-track-number" aria-hidden="true">{active && playing ? <span className="synapse-equalizer"><i /><i /><i /></span> : String(index + 1).padStart(2, '0')}</span>
    <span className="synapse-track-cover">
      {track.coverArt ? <img src={`/api/stream/cover/${encodeURIComponent(track.coverArt)}?size=100`} loading="lazy" alt="" /> : <Music2 size={20} aria-hidden="true" />}
      <span className="synapse-track-play" aria-hidden="true">{active && playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</span>
    </span>
    <span className="synapse-track-copy"><span className="synapse-track-title">{track.title}</span><span className="synapse-track-artist">{cleanArtistName(track.artist)}</span><span className="synapse-track-reason">{track.synapse.reason}</span></span>
    <span className="synapse-track-duration">{Math.floor((track.duration || 0) / 60)}:{String(Math.floor((track.duration || 0) % 60)).padStart(2, '0')}</span>
  </button>;
}
