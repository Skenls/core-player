import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Play, Heart, ListPlus } from 'lucide-react';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites';
import { AddToPlaylistModal } from '@/components/modals/AddToPlaylistModal';
import { cleanArtistName } from '@/lib/formatters';
import type { Track } from '@/types/subsonic';

// In-memory cache of already loaded image URLs to prevent opacity-0 flashes
const loadedImageCache = new Set<string>();

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

export const TrackCard = memo(function TrackCard({ track, onPlay }: TrackCardProps) {
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteIds?.tracks.includes(track.id) ?? false;
  
  const coverUrl = track.coverArt 
    ? `/api/stream/cover/${track.coverArt}?size=300`
    : '/placeholder-album.png';
  
  const [imageLoaded, setImageLoaded] = useState(() => loadedImageCache.has(coverUrl));
  
  const handleClick = () => {
    onPlay();
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="group relative bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 cursor-pointer hover:bg-white/[0.08] hover:border-white/[0.16] transition-colors duration-200 transform-gpu will-change-transform"
        onClick={handleClick}
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-white/5">
          <img
            src={coverUrl}
            alt={track.album}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => {
              loadedImageCache.add(coverUrl);
              setImageLoaded(true);
            }}
          />
          
          {/* Quick Action Buttons (Favorite + Playlist) in corners */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite.mutate({ id: track.id, type: 'track' });
              }}
              className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-white/70 hover:text-white transition-colors shadow-md"
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
              className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-white/70 hover:text-white transition-colors shadow-md"
              title="Добавить в плейлист"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>
          
          {/* Play button overlay */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-200">
              <Play className="w-6 h-6 fill-black ml-0.5" />
            </div>
          </div>
          
          <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-t from-blue-500/50 to-transparent blur-xl pointer-events-none" />
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
            {cleanArtistName(track.artist)}
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
});
