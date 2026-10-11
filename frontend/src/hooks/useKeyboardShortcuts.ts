import { useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function useKeyboardShortcuts() {
  const { 
    currentTrack, 
    togglePlayPause, 
    currentTime, 
    duration, 
    seek
  } = usePlayerStore();
  
  const { 
    isNowPlayingOpen, 
    toggleNowPlaying, 
    closeNowPlaying, 
    isSettingsOpen, 
    toggleSettings 
  } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input, textarea or select
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (currentTrack) {
            togglePlayPause();
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (currentTrack) {
            seek(Math.max(0, currentTime - 5));
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentTrack) {
            seek(Math.min(duration || 0, currentTime + 5));
          }
          break;

        case 'KeyF':
          e.preventDefault();
          if (currentTrack) {
            toggleNowPlaying();
          }
          break;

        case 'Escape':
          if (isNowPlayingOpen) {
            closeNowPlaying();
          } else if (isSettingsOpen) {
            toggleSettings();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTrack,
    togglePlayPause,
    currentTime,
    duration,
    seek,
    isNowPlayingOpen,
    toggleNowPlaying,
    closeNowPlaying,
    isSettingsOpen,
    toggleSettings,
  ]);
}
