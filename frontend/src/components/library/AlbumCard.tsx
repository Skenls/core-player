import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Disc } from 'lucide-react';
import { cleanArtistName } from '@/lib/formatters';
import type { Album } from '@/types/subsonic';

// In-memory cache of already loaded cover URLs to avoid reload flicker
const loadedAlbumCovers = new Set<string>();

interface AlbumCardProps {
  album: Album;
  onClick: () => void;
}

export const AlbumCard = memo(function AlbumCard({ album, onClick }: AlbumCardProps) {
  const coverUrl = album.coverArt 
    ? `/api/stream/cover/${album.coverArt}?size=300` 
    : '';

  const [imageLoaded, setImageLoaded] = useState(() => !!coverUrl && loadedAlbumCovers.has(coverUrl));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="group relative bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 cursor-pointer hover:bg-white/[0.08] hover:border-white/[0.16] transition-colors duration-200 transform-gpu will-change-transform"
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 mb-4">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.name}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => {
              loadedAlbumCovers.add(coverUrl);
              setImageLoaded(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/30">
            <Disc className="w-12 h-12" />
          </div>
        )}

        {/* Ambient subtle glow on hover, without a play button overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-200 bg-gradient-to-t from-blue-500/40 to-transparent pointer-events-none" />
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-white truncate" title={album.name}>
          {album.name}
        </h3>
        <p className="text-sm text-white/50 truncate" title={album.artist}>
          {cleanArtistName(album.artist) || 'Неизвестный исполнитель'}
        </p>
      </div>
    </motion.div>
  );
});
