'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Heart, Repeat, Repeat1, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { LyricsView } from './LyricsView';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';

export function NowPlayingView() {
  const { isNowPlayingOpen, closeNowPlaying, backgroundMode, customBackgroundUrl } = useUIStore();
  const { 
    currentTrack, 
    isPlaying, 
    repeat, 
    shuffle,
    togglePlayPause, 
    previousTrack, 
    nextTrack,
    toggleRepeat,
    toggleShuffle
  } = usePlayerStore();
  
  const [isFavorite, setIsFavorite] = useState(false);
  
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
    staleTime: Infinity
  });
  
  if (!currentTrack) return null;
  
  const coverUrl = currentTrack.coverArt
    ? `/api/stream/cover/${currentTrack.coverArt}?size=600`
    : '/placeholder-album.png';
    
  // Determine background image
  const backgroundImage = backgroundMode === 'custom' 
    ? customBackgroundUrl 
    : coverUrl;
  
  return (
    <AnimatePresence>
      {isNowPlayingOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0">
            <motion.img
              key={backgroundMode === 'custom' ? 'custom' : currentTrack.id}
              src={backgroundImage}
              alt=""
              className="w-full h-full object-cover scale-110 blur-3xl brightness-50 opacity-60"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ duration: 0.8 }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
          </div>
          
          <div className="relative z-10 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={closeNowPlaying}
                className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </motion.button>
            </div>
            
            {/* Main content */}
            <div className="flex-1 flex items-center gap-12 px-12 pb-32">
              {/* Left: Album art and info */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 30 }}
                className="flex-shrink-0 w-[480px] space-y-8"
              >
                <motion.div
                  layoutId="player-artwork"
                  className="aspect-square rounded-3xl overflow-hidden shadow-2xl bg-white/5"
                >
                  <img
                    src={coverUrl}
                    alt={currentTrack.album}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
                
                {/* Track info */}
                <div className="space-y-4 px-4">
                  <div className="space-y-2">
                    <motion.h1
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-4xl font-bold text-white leading-tight"
                    >
                      {currentTrack.title}
                    </motion.h1>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="text-xl text-white/70"
                    >
                      {currentTrack.artist} · {currentTrack.album}
                    </motion.p>
                  </div>
                  
                  {/* Controls */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-4 pt-4"
                  >
                    {/* Shuffle */}
                    <button
                      onClick={toggleShuffle}
                      className={`p-3 hover:bg-white/10 rounded-xl transition-colors ${
                        shuffle ? 'text-blue-400' : 'text-white/50'
                      }`}
                    >
                      <Shuffle className="w-5 h-5" />
                    </button>
                    
                    {/* Previous */}
                    <button
                      onClick={previousTrack}
                      className="p-3 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <SkipBack className="w-6 h-6 text-white" />
                    </button>
                    
                    {/* Play/Pause */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlayPause}
                      className="w-16 h-16 flex items-center justify-center bg-white hover:bg-white/90 rounded-full transition-colors"
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
                      className="p-3 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <SkipForward className="w-6 h-6 text-white" />
                    </button>
                    
                    {/* Repeat */}
                    <button
                      onClick={toggleRepeat}
                      className={`p-3 hover:bg-white/10 rounded-xl transition-colors ${
                        repeat !== 'off' ? 'text-blue-400' : 'text-white/50'
                      }`}
                    >
                      {repeat === 'one' ? (
                        <Repeat1 className="w-5 h-5" />
                      ) : (
                        <Repeat className="w-5 h-5" />
                      )}
                    </button>
                    
                    {/* Favorite */}
                    <button
                      onClick={() => setIsFavorite(!isFavorite)}
                      className="p-3 hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Heart 
                        className={`w-5 h-5 transition-colors ${
                          isFavorite ? 'fill-red-500 text-red-500' : 'text-white/50'
                        }`}
                      />
                    </button>
                  </motion.div>
                </div>
              </motion.div>
              
              {/* Right: Lyrics */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 30 }}
                className="flex-1 h-full"
              >
                <LyricsView lyrics={lyrics} />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
