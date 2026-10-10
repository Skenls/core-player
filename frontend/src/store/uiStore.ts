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
  
  // Album navigation
  selectedAlbumId: string | null;
  previousTab: ActiveTab | null;
  openAlbum: (albumId: string) => void;
  closeAlbum: () => void;
  
  // Settings
  backgroundMode: BackgroundMode;
  customBackgroundUrl: string;
  backgroundBlur: number;
  backgroundDim: number;
  audioCodec: AudioCodec;
  nowPlayingBackground: boolean;
  
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
  setNowPlayingBackground: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'home',
      isSidebarOpen: true,
      isNowPlayingOpen: false,
      isSettingsOpen: false,
      isQueueOpen: false,
      
      selectedAlbumId: null,
      previousTab: null,
      
      backgroundMode: 'dynamic',
      customBackgroundUrl: '/background.jpg',
      backgroundBlur: 24,
      backgroundDim: 40,
      audioCodec: 'mp3',
      nowPlayingBackground: true,
      
      setActiveTab: (tab) => set((state) => ({ 
        activeTab: tab, 
        selectedAlbumId: tab === 'albums' ? null : state.selectedAlbumId,
        previousTab: null 
      })),

      openAlbum: (albumId) => set((state) => ({
        selectedAlbumId: albumId,
        previousTab: state.activeTab !== 'albums' ? state.activeTab : state.previousTab,
        activeTab: 'albums'
      })),

      closeAlbum: () => set((state) => ({
        selectedAlbumId: null,
        activeTab: state.previousTab || 'albums',
        previousTab: null
      })),
      
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
      setAudioCodec: (codec) => set({ audioCodec: codec }),
      setNowPlayingBackground: (enabled) => set({ nowPlayingBackground: enabled })
    }),
    {
      name: 'core-ui-settings',
      partialize: (state) => ({
        backgroundMode: state.backgroundMode,
        customBackgroundUrl: state.customBackgroundUrl,
        backgroundBlur: state.backgroundBlur,
        backgroundDim: state.backgroundDim,
        audioCodec: state.audioCodec,
        nowPlayingBackground: state.nowPlayingBackground,
        isSidebarOpen: state.isSidebarOpen
      })
    }
  )
);
