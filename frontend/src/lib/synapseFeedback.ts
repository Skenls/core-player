/** Feedback uses heard audio, so a seek to the end is not a completion. */
export function classifyPlayback(played: number, duration: number) {
  const percent = duration > 0 ? Math.min(1, Math.max(0, played / duration)) : 0;
  if (duration > 0 && percent >= 0.85) return { event_type: 'complete' as const, percent };
  const skip_kind = played < Math.min(20, duration * 0.25) ? 'strong' as const
    : played < Math.min(60, duration * 0.5) ? 'weak' as const : 'neutral' as const;
  return { event_type: 'skip' as const, percent, skip_kind };
}

export function heardDelta(positionDelta: number, elapsed: number, playing: boolean, seeking: boolean) {
  if (!playing || seeking || positionDelta <= 0 || positionDelta > elapsed + 0.75) return 0;
  return Math.min(positionDelta, elapsed + 0.1);
}
