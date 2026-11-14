import { useEffect, useRef } from 'react';
import { synapseApi } from '@/api/synapse';
import { audioService } from '@/lib/audioService';
import { classifyPlayback, heardDelta } from '@/lib/synapseFeedback';
import { usePlayerStore } from '@/store/playerStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSynapseStore } from '@/store/synapseStore';
import { isSynapseTrack, type SynapseEvent, type SynapseTrack } from '@/types/synapse';

export function useSynapseTelemetry() {
  const userId = useSessionStore(state => state.user?.id);
  const profileVersion = useSynapseStore(state => state.profileVersion);
  const resetting = useSynapseStore(state => state.profileResetting);
  const previousVersion = useRef(profileVersion);
  const ignoredSessions = useRef(new Set<string>());
  const mountedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || resetting) return;
    const storageKey = `core-synapse-events:${userId}`;
    const audio = audioService.getAudio();
    if (mountedUser.current !== userId) {
      // A queue can outlive logout; only fresh mixes may train the next account.
      const state = usePlayerStore.getState();
      for (const track of [...(state.queue || []), state.currentTrack]) {
        if (isSynapseTrack(track)) ignoredSessions.current.add(track.synapse.session_id);
      }
      mountedUser.current = userId;
    }
    if (previousVersion.current !== profileVersion) {
      const state = usePlayerStore.getState();
      for (const track of [...(state.queue || []), state.currentTrack]) {
        if (isSynapseTrack(track)) ignoredSessions.current.add(track.synapse.session_id);
      }
      previousVersion.current = profileVersion;
    }
    let pending: SynapseEvent[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) pending = stored.filter(event => event && typeof event.id === 'string').slice(-200);
    } catch { /* Storage is optional, in-memory delivery still works. */ }
    let active: { track: SynapseTrack; played: number; position: number; sampledAt: number } | null = null;
    let sending = false;
    let disposed = false;
    const persist = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(pending)); } catch { /* Memory fallback. */ }
    };
    const enqueue = (event: SynapseEvent) => {
      pending = [...pending, event].slice(-200);
      persist();
    };
    const flush = async () => {
      if (sending || disposed || !pending.length || !navigator.onLine
        || useSessionStore.getState().user?.id !== userId) return;
      sending = true;
      const batch = pending.slice(0, 50);
      try {
        await synapseApi.events(batch);
        if (disposed) return;
        const ids = new Set(batch.map(event => event.id));
        pending = pending.filter(event => !ids.has(event.id));
        persist();
      } catch {
        // Keep event UUIDs unchanged when retrying.
      } finally { sending = false; }
    };
    const sample = () => {
      if (!active) return;
      const now = performance.now();
      const position = audioService.getCurrentTime();
      active.played += heardDelta(position - active.position, (now - active.sampledAt) / 1000,
        !audio.paused || audio.ended, audio.seeking);
      active.position = position;
      active.sampledAt = now;
    };
    const eventFor = (track: SynapseTrack, event_type: SynapseEvent['event_type'], played: number,
      position: number, context: SynapseEvent['context']): SynapseEvent => ({
      id: crypto.randomUUID(), session_id: track.synapse.session_id, track_id: track.id,
      event_type, position_seconds: Math.max(0, position), duration_seconds: track.duration || 0,
      percent: track.duration > 0 ? Math.min(1, played / track.duration) : 0,
      client_ts: new Date().toISOString(), context
    });
    const begin = () => {
      const track = usePlayerStore.getState().currentTrack;
      if (active || !isSynapseTrack(track) || ignoredSessions.current.has(track.synapse.session_id)) return;
      active = { track, played: 0, position: audioService.getCurrentTime(), sampledAt: performance.now() };
      enqueue(eventFor(track, 'start', 0, 0, { played_seconds: 0 }));
    };
    const finalize = (ended = false) => {
      if (!active) return;
      sample();
      const { track, played, position } = active;
      active = null;
      const feedback = classifyPlayback(played, track.duration);
      enqueue(eventFor(track, feedback.event_type, played, position,
        { played_seconds: played, skip_kind: feedback.skip_kind, ended }));
      void flush();
    };
    const onEnded = () => finalize(true);
    const onProgress = () => { sample(); };
    const onSeeked = () => {
      if (active) { active.position = audioService.getCurrentTime(); active.sampledAt = performance.now(); }
    };
    const onPause = () => { sample(); };
    const onPlaying = () => {
      begin();
      if (active) { active.position = audioService.getCurrentTime(); active.sampledAt = performance.now(); }
    };
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (state.playbackId !== previous.playbackId || (!previous.queueEnded && state.queueEnded)) finalize();
    });
    const beacon = () => {
      persist();
      if (pending.length && useSessionStore.getState().user?.id === userId) {
        const base = ((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '/api').replace(/\/$/, '');
        const url = new URL(`${base}/synapse/events`, window.location.href);
        if (url.origin === window.location.origin && navigator.sendBeacon) {
          navigator.sendBeacon(url.href, new Blob([JSON.stringify({ events: pending.slice(0, 50) })],
            { type: 'application/json' }));
        }
      }
    };
    const onHide = () => { finalize(); beacon(); };
    const onVisible = () => {
      if (document.visibilityState === 'hidden') { sample(); void flush(); beacon(); }
      else if (!audio.paused) begin();
    };
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('timeupdate', onProgress);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeking', onProgress);
    audio.addEventListener('seeked', onSeeked);
    // Capture runs before the player's ended handler switches the source.
    audio.addEventListener('ended', onEnded, true);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { sample(); void flush(); }, 10_000);
    if (!audio.paused) begin();
    void flush();
    return () => {
      disposed = true;
      if (useSynapseStore.getState().profileVersion !== profileVersion) {
        pending = [];
        persist();
      } else {
        // An account switch must never send old feedback under the next account's cookie.
        if (useSessionStore.getState().user?.id === userId) finalize();
        persist();
      }
      unsubscribe();
      clearInterval(timer);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('timeupdate', onProgress);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeking', onProgress);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded, true);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, profileVersion, resetting]);
}
