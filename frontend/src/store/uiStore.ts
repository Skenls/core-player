import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ActiveTab = 'home' | 'favorites' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'settings';
export type BackgroundMode = 'dynamic' | 'custom';
export type AudioCodec = 'mp3' | 'raw' | 'opus' | 'flac';

interface UIState {
  // Navigation
  activeTab: ActiveTab;
  isSidebarOpen: boolean;
  
  // Now Playing view
  isNowPlayingOpen: boolean;
  
  // Modals
  isSettingsOpen: boolean;
  isQueueOpen: boolean;
  
  // Settings
  backgroundMode: BackgroundMode;
  customBackgroundUrl: string;
  backgroundBlur: number;
  backgroundDim: number;
  audioCodec: AudioCodec;
  
  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  toggleNowPlaying: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  
  toggleSettings: () => void;
  toggleQueue: () => void;
  
  setBackgroundMode: (mode: BackgroundMode) => void;
  setCustomBackgroundUrl: (url: string) => void;
  setBackgroundBlur: (blur: number) => void;
  setBackgroundDim: (dim: number) => void;
  setAudioCodec: (codec: AudioCodec) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'home',
      isSidebarOpen: true,
      isNowPlayingOpen: false,
      isSettingsOpen: false,
      isQueueOpen: false,
      
      backgroundMode: 'dynamic',
      customBackgroundUrl: '/background.jpg',
      backgroundBlur: 24,
      backgroundDim: 40,
      audioCodec: 'mp3',
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      toggleNowPlaying: () => set((state) => ({ isNowPlayingOpen: !state.isNowPlayingOpen })),
      openNowPlaying: () => set({ isNowPlayingOpen: true }),
      closeNowPlaying: () => set({ isNowPlayingOpen: false }),
      
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),
      
      setBackgroundMode: (mode) => set({ backgroundMode: mode }),
      setCustomBackgroundUrl: (url) => set({ customBackgroundUrl: url }),
      setBackgroundBlur: (blur) => set({ backgroundBlur: blur }),
      setBackgroundDim: (dim) => set({ backgroundDim: dim }),
      setAudioCodec: (codec) => set({ audioCodec: codec })
    }),
    {
      name: 'core-ui-settings',
      partialize: (state) => ({
        backgroundMode: state.backgroundMode,
        customBackgroundUrl: state.customBackgroundUrl,
        backgroundBlur: state.backgroundBlur,
        backgroundDim: state.backgroundDim,
        audioCodec: state.audioCodec,
        isSidebarOpen: state.isSidebarOpen
      })
    }
  )
);
