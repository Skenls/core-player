import { useEffect } from 'react';
import { audioService } from '@/lib/audioService';
import { usePlayerStore } from '@/store/playerStore';

export function useAudioEngine() {
  const { currentTrack, nextTrack, updateProgress, repeat, seekRequestedTime, clearSeekRequest } = usePlayerStore();
  
  // Initialize audio service
  useEffect(() => {
    audioService.initialize();
    
    return () => {
      audioService.destroy();
    };
  }, []);
  
  // Handle seek requests from store
  useEffect(() => {
    if (seekRequestedTime !== null) {
      audioService.seek(seekRequestedTime);
      clearSeekRequest();
    }
  }, [seekRequestedTime, clearSeekRequest]);
  
  // Event listeners
  useEffect(() => {
    const audio = audioService.getAudio();
    
    const handleTimeUpdate = () => {
      updateProgress(audio.currentTime, audio.duration);
    };
    
    const handleEnded = () => {
      if (repeat === 'one') {
        // Repeat one: restart and play
        audioService.seek(0);
        audioService.play();
      } else {
        nextTrack();
      }
    };
    
    const handleError = (e: Event) => {
      const audioEl = audioService.getAudio();
      if (!audioEl.src || audioEl.src === window.location.href) return;
      console.error('Audio error:', e);
      usePlayerStore.getState().pause();
    };
    
    const handleCanPlay = () => {
      updateProgress(audio.currentTime, audio.duration);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [nextTrack, updateProgress, repeat]);
  
  // MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.coverArt ? [
        { src: `/api/stream/cover/${currentTrack.coverArt}?size=96`, sizes: '96x96', type: 'image/jpeg' },
        { src: `/api/stream/cover/${currentTrack.coverArt}?size=256`, sizes: '256x256', type: 'image/jpeg' },
        { src: `/api/stream/cover/${currentTrack.coverArt}?size=512`, sizes: '512x512', type: 'image/jpeg' }
      ] : []
    });
    
    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().play());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().previousTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().nextTrack());
    
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        usePlayerStore.getState().seek(details.seekTime);
      }
    });
  }, [currentTrack]);
}
