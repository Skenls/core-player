import { create } from 'zustand';
import { audioService } from '@/lib/audioService';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types/subsonic';
import type { RepeatMode } from '@/types/player';

interface PlayerState {
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
  
  setCurrentTrack: (track: Track) => void;
  reloadCodec: () => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  clearSeekRequest: () => void;
  setVolume: (volume: number) => void;
  
  nextTrack: () => void;
  previousTrack: () => void;
  
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  
  updateProgress: (currentTime: number, duration: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  queue: [],
  queueIndex: -1,
  originalQueue: [],
  shuffle: false,
  repeat: 'off',
  seekRequestedTime: null,
  
  setCurrentTrack: (track) => {
    set({ currentTrack: track });
    const { audioCodec } = useUIStore.getState();
    const codecParam = audioCodec && audioCodec !== 'raw' ? `?format=${audioCodec}` : '';
    audioService.setSrc(`/api/stream/${track.id}${codecParam}`);
  },

  reloadCodec: () => {
    const { currentTrack, currentTime, isPlaying } = get();
    if (!currentTrack) return;
    const { audioCodec } = useUIStore.getState();
    const codecParam = audioCodec && audioCodec !== 'raw' ? `?format=${audioCodec}` : '';
    audioService.setSrc(`/api/stream/${currentTrack.id}${codecParam}`);
    audioService.seek(currentTime);
    if (isPlaying) {
      audioService.play().catch(() => {});
    }
  },
  
  play: () => {
    set({ isPlaying: true });
    audioService.play().catch(() => {
      // Error already handled in audioService
    });
  },
  
  pause: () => {
    set({ isPlaying: false });
    audioService.pause();
  },
  
  togglePlayPause: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },
  
  seek: (time) => {
    set({ seekRequestedTime: time, currentTime: time });
    audioService.seek(time);
  },
  
  clearSeekRequest: () => set({ seekRequestedTime: null }),
  
  setVolume: (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: clampedVolume });
    audioService.setVolume(clampedVolume);
  },
  
  nextTrack: () => {
    const { queue, queueIndex, repeat } = get();
    
    if (repeat === 'one') {
      audioService.seek(0);
      audioService.play();
      set({ currentTime: 0 });
      return;
    }
    
    let nextIndex = queueIndex + 1;
    
    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        audioService.pause();
        return;
      }
    }
    
    const nextTrack = queue[nextIndex];
    set({
      queueIndex: nextIndex,
      currentTrack: nextTrack,
      currentTime: 0
    });
    audioService.setSrc(`/api/stream/${nextTrack.id}`);
    audioService.play();
  },
  
  previousTrack: () => {
    const { queue, queueIndex, currentTime } = get();
    
    if (currentTime > 3) {
      get().seek(0);
      return;
    }
    
    const prevIndex = queueIndex - 1;
    if (prevIndex < 0) return;
    
    const prevTrack = queue[prevIndex];
    set({
      queueIndex: prevIndex,
      currentTrack: prevTrack,
      currentTime: 0
    });
    audioService.setSrc(`/api/stream/${prevTrack.id}`);
    audioService.play();
  },
  
  setQueue: (tracks, startIndex = 0) => {
    const track = tracks[startIndex];
    set({
      queue: tracks,
      originalQueue: tracks,
      queueIndex: startIndex,
      currentTrack: track || null,
      currentTime: 0
    });
    
    if (track) {
      audioService.setSrc(`/api/stream/${track.id}`);
    }
  },
  
  addToQueue: (track) => {
    set((state) => ({
      queue: [...state.queue, track]
    }));
  },
  
  playNext: (track) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(state.queueIndex + 1, 0, track);
      return { queue: newQueue };
    });
  },
  
  removeFromQueue: (index) => {
    set((state) => {
      const newQueue = state.queue.filter((_, i) => i !== index);
      const newIndex = index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex;
      return {
        queue: newQueue,
        queueIndex: newIndex
      };
    });
  },
  
  reorderQueue: (fromIndex, toIndex) => {
    set((state) => {
      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      
      let newIndex = state.queueIndex;
      if (fromIndex === state.queueIndex) {
        newIndex = toIndex;
      } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
        newIndex--;
      } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
        newIndex++;
      }
      
      return { queue: newQueue, queueIndex: newIndex };
    });
  },
  
  toggleShuffle: () => {
    set((state) => {
      if (state.shuffle) {
        return {
          shuffle: false,
          queue: state.originalQueue,
          queueIndex: state.originalQueue.findIndex(t => t.id === state.currentTrack?.id)
        };
      } else {
        const currentTrack = state.currentTrack;
        const shuffled = [...state.queue]
          .filter(t => t.id !== currentTrack?.id)
          .sort(() => Math.random() - 0.5);
        
        const newQueue = currentTrack ? [currentTrack, ...shuffled] : shuffled;
        
        return {
          shuffle: true,
          queue: newQueue,
          queueIndex: 0
        };
      }
    });
  },
  
  toggleRepeat: () => {
    set((state) => ({
      repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
    }));
  },
  
  updateProgress: (currentTime, duration) => {
    set({ currentTime, duration });
  }
}));
