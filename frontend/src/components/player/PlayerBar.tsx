'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Heart, Repeat, Repeat1 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeat,
    togglePlayPause,
    previousTrack,
    nextTrack,
    toggleRepeat,
    seek
  } = usePlayerStore();
  
  const { openNowPlaying, isSidebarOpen } = useUIStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const displayTime = isDragging ? dragTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    
    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * duration;
    setDragTime(time);
  };
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || !duration) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = percent * duration;
      setDragTime(time);
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
  
  if (!currentTrack) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        left: isSidebarOpen ? '256px' : '0',
        transition: 'left 300ms'
      }}
    >
      <div className="bg-black/40 backdrop-blur-2xl border-t border-white/10">
        {/* Progress bar */}
        <div
          ref={progressBarRef}
          onMouseDown={handleProgressMouseDown}
          className="relative h-1 bg-white/10 cursor-pointer group"
        >
          <motion.div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ width: `${progress}%` }}
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            style={{ left: `${progress}%`, x: '-50%' }}
          />
        </div>
        
        {/* Main controls - centered */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto gap-8">
            
            {/* Left: Track info */}
            <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xs">
              <motion.button
                onClick={openNowPlaying}
                className="flex items-center gap-3 min-w-0 group flex-1"
              >
                {currentTrack.coverArt && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-white/10 group-hover:ring-white/30 transition-all">
                    <img
                      src={`/api/stream/cover/${currentTrack.coverArt}?size=96`}
                      alt={currentTrack.album}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white font-medium truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-white/50 text-sm truncate">
                    {currentTrack.artist}
                  </p>
                </div>
              </motion.button>
              
              {/* Favorite button */}
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <Heart 
                  className={`w-5 h-5 transition-colors ${
                    isFavorite ? 'fill-red-500 text-red-500' : 'text-white/50'
                  }`}
                />
              </button>
            </div>
            
            {/* Center: Playback controls */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={previousTrack}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <SkipBack className="w-5 h-5 text-white/70" />
                </button>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlayPause}
                  className="w-12 h-12 flex items-center justify-center bg-white hover:bg-white/90 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-black fill-black" />
                  ) : (
                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                  )}
                </motion.button>
                
                <button
                  onClick={nextTrack}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <SkipForward className="w-5 h-5 text-white/70" />
                </button>
              </div>
              
              {/* Time display */}
              <div className="flex items-center gap-2 text-xs text-white/50 font-mono">
                <span>{formatTime(displayTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Right: Repeat control */}
            <div className="flex items-center justify-end gap-2 flex-1 max-w-xs">
              <button
                onClick={toggleRepeat}
                className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                  repeat !== 'off' ? 'text-blue-400' : 'text-white/50'
                }`}
                title={
                  repeat === 'off' ? 'Повтор выключен' : 
                  repeat === 'one' ? 'Повтор трека' : 
                  'Повтор всех'
                }
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </motion.div>
  );
}
