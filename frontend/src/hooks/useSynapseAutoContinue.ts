import { useEffect } from 'react';
import { synapseApi } from '@/api/synapse';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSynapseStore } from '@/store/synapseStore';

export function useSynapseAutoContinue() {
  const queueEnded = usePlayerStore(state => state.queueEnded);
  const queueVersion = usePlayerStore(state => state.queueVersion);
  const enabled = useUIStore(state => state.continuePlayback);
  const userId = useSessionStore(state => state.user?.id);
  const resetting = useSynapseStore(state => state.profileResetting);
  const profileVersion = useSynapseStore(state => state.profileVersion);

  useEffect(() => {
    if (resetting || !queueEnded || !enabled || !userId || !navigator.onLine) return;
    let cancelled = false;
    const initial = usePlayerStore.getState();
    if (initial.repeat !== 'off') return;
    const isCurrent = () => {
      const current = usePlayerStore.getState();
      return !cancelled && navigator.onLine && useSessionStore.getState().user?.id === userId
        && current.queueVersion === queueVersion && current.queueEnded && current.repeat === 'off'
        && useUIStore.getState().continuePlayback && !useSynapseStore.getState().profileResetting
        && useSynapseStore.getState().profileVersion === profileVersion;
    };
    const excluded = initial.queue.map(track => track.id);
    const filters = useSynapseStore.getState().filters;
    const refill = async () => {
      try {
        const status = await synapseApi.status();
        if (!isCurrent() || status.status !== 'ready') return;
        const mix = await synapseApi.getMix(filters, 15, excluded);
        const current = usePlayerStore.getState();
        if (!isCurrent()) return;
        const tracks = mix.tracks.filter(track => !excluded.includes(track.id));
        if (!tracks.length) return;
        current.appendToQueue(tracks);
        useSynapseStore.getState().setNotice(`Synapse добавил ${tracks.length} треков`);
      } catch {
        // Keep the ended queue stopped; the next queue end can retry.
      }
    };
    void refill();
    return () => { cancelled = true; };
  }, [queueEnded, queueVersion, enabled, userId, profileVersion, resetting]);
}
