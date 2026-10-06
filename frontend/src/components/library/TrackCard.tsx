'use client';

import { motion } from 'framer-motion';
import { Play, Heart, ListPlus } from 'lucide-react';
import { useState } from 'react';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites';
import { AddToPlaylistModal } from '@/components/modals/AddToPlaylistModal';
import type { Track } from '@/types/subsonic';

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

export function TrackCard({ track, onPlay }: TrackCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteIds?.tracks.includes(track.id) ?? false;
  
  const coverUrl = track.coverArt 
    ? `/api/stream/cover/${track.coverArt}?size=300`
    : '/placeholder-album.png';
  
  const handleClick = () => {
    onPlay(); // Start playing without opening full screen card
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-4 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
        onClick={handleClick}
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-white/5">
          <motion.img
            src={coverUrl}
            alt={track.album}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: imageLoaded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* Quick Action Buttons (Favorite + Playlist) in corners */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite.mutate({ id: track.id, type: 'track' });
              }}
              className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/80 text-white/70 hover:text-white transition-all shadow-md"
              title={isFavorite ? 'Удалить из избранного' : 'В избранное'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaylistModalOpen(true);
              }}
              className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/80 text-white/70 hover:text-white transition-all shadow-md"
              title="Добавить в плейлист"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>
          
          {/* Play button overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl"
            >
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </motion.button>
          </motion.div>
          
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity bg-gradient-to-t from-blue-500/50 to-transparent blur-2xl pointer-events-none" />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white truncate flex-1">
              {track.title}
            </h3>
            {isFavorite && (
              <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-white/50 truncate">
            {track.artist}
          </p>
        </div>
      </motion.div>

      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        track={track}
      />
    </>
  );
}
