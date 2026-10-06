'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Heart, 
  Repeat, 
  Repeat1, 
  Shuffle, 
  ListPlus 
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { LyricsView } from './LyricsView';
import { AddToPlaylistModal } from '@/components/modals/AddToPlaylistModal';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites';

export function NowPlayingView() {
  const { isNowPlayingOpen, closeNowPlaying, nowPlayingBackground } = useUIStore();
  const { 
    currentTrack, 
    isPlaying, 
    currentTime,
    duration,
    repeat, 
    shuffle,
    togglePlayPause, 
    previousTrack, 
    nextTrack,
    toggleRepeat,
    toggleShuffle,
    seek
  } = usePlayerStore();
  
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const isFavorite = currentTrack ? favoriteIds?.tracks.includes(currentTrack.id) : false;

  const { data: lyrics } = useQuery({
    queryKey: ['lyrics', currentTrack?.id],
    queryFn: () => currentTrack 
      ? api.lyrics.getLyrics(
          currentTrack.id, 
          currentTrack.artist, 
          currentTrack.title,
          currentTrack.album,
          currentTrack.duration
        )
      : null,
    enabled: !!currentTrack && isNowPlayingOpen,
    staleTime: 1000 * 60 * 10,
  });

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNowPlayingOpen) {
        closeNowPlaying();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNowPlayingOpen, closeNowPlaying]);

  // Handle progress dragging
  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragTime(pct * duration);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || !duration) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragTime(pct * duration);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      seek(dragTime);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragTime, duration, seek]);
  
  if (!currentTrack) return null;
  
  const coverUrl = currentTrack.coverArt
    ? `/api/stream/cover/${currentTrack.coverArt}?size=600`
    : '/placeholder-album.png';

  return (
    <>
      <AnimatePresence>
        {isNowPlayingOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 overflow-hidden bg-[#121316] select-none"
          >
            {/* Opaque blurred backdrop */}
            {nowPlayingBackground && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover scale-125 blur-[100px] opacity-25 brightness-50"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#121316]/90 via-[#121316]/75 to-[#121316]/95" />
              </div>
            )}
            
            <div className="relative z-10 h-full flex flex-col">
              {/* Header with collapse chevron */}
              <div className="flex items-center justify-end px-8 pt-6">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={closeNowPlaying}
                  className="p-3 bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors shadow-lg"
                  title="Свернуть (Esc)"
                >
                  <ChevronDown className="w-6 h-6" />
                </motion.button>
              </div>
              
              {/* Main 2-column centered layout */}
              <div className="flex-1 max-w-6xl w-full mx-auto flex items-center justify-center gap-16 px-8 pb-10">
                
                {/* Left Column: Artwork, Info & Controls */}
                <motion.div
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="flex-shrink-0 w-[420px] space-y-6"
                >
                  {/* Big Album Artwork */}
                  <div className="aspect-square w-full rounded-3xl overflow-hidden shadow-2xl bg-white/5 border border-white/10 group relative">
                    <img
                      src={coverUrl}
                      alt={currentTrack.album}
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                  
                  {/* Track Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <h1 className="text-3xl font-bold text-white leading-tight truncate">
                        {currentTrack.title}
                      </h1>
                      <button
                        onClick={() => toggleFavorite.mutate({ id: currentTrack.id, type: 'track' })}
                        className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors flex-shrink-0"
                        title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                      >
                        <Heart className={`w-6 h-6 transition-colors ${
                          isFavorite ? 'fill-red-500 text-red-500' : 'text-white/40'
                        }`} />
                      </button>
                    </div>
                    <p className="text-lg text-white/60 truncate font-medium">
                      {currentTrack.artist}
                    </p>
                    <p className="text-xs text-white/30 truncate">
                      {currentTrack.album}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div
                      ref={progressBarRef}
                      onMouseDown={handleProgressMouseDown}
                      className="relative h-1.5 bg-white/15 rounded-full cursor-pointer group hover:h-2 transition-all"
                    >
                      <div
                        className="absolute left-0 top-0 h-full bg-white rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono text-white/40">
                      <span>{formatTime(displayTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls Toolbar */}
                  <div className="flex items-center justify-between pt-2">
                    {/* Shuffle */}
                    <button
                      onClick={toggleShuffle}
                      className={`p-2.5 hover:bg-white/10 rounded-xl transition-colors ${
                        shuffle ? 'text-blue-400' : 'text-white/40 hover:text-white'
                      }`}
                      title="Перемешать"
                    >
                      <Shuffle className="w-5 h-5" />
                    </button>
                    
                    {/* Previous */}
                    <button
                      onClick={previousTrack}
                      className="p-3 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                      title="Предыдущий"
                    >
                      <SkipBack className="w-6 h-6" />
                    </button>
                    
                    {/* Play/Pause */}
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={togglePlayPause}
                      className="w-16 h-16 flex items-center justify-center bg-white hover:bg-white/90 rounded-full shadow-2xl transition-colors"
                      title={isPlaying ? 'Пауза' : 'Воспроизведение'}
                    >
                      {isPlaying ? (
                        <Pause className="w-7 h-7 text-black fill-black" />
                      ) : (
                        <Play className="w-7 h-7 text-black fill-black ml-1" />
                      )}
                    </motion.button>
                    
                    {/* Next */}
                    <button
                      onClick={nextTrack}
                      className="p-3 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                      title="Следующий"
                    >
                      <SkipForward className="w-6 h-6" />
                    </button>
                    
                    {/* Repeat */}
                    <button
                      onClick={toggleRepeat}
                      className={`p-2.5 hover:bg-white/10 rounded-xl transition-colors ${
                        repeat !== 'off' ? 'text-blue-400' : 'text-white/40 hover:text-white'
                      }`}
                      title="Повтор"
                    >
                      {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                    </button>

                    {/* Add to Playlist */}
                    <button
                      onClick={() => setIsPlaylistModalOpen(true)}
                      className="p-2.5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-colors"
                      title="Добавить в плейлист"
                    >
                      <ListPlus className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
                
                {/* Right Column: Synced Lyrics */}
                <motion.div
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="flex-1 h-[520px] max-w-xl"
                >
                  <LyricsView lyrics={lyrics} />
                </motion.div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        track={currentTrack}
      />
    </>
  );
}
