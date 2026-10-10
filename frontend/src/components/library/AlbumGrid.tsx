import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrackCard } from './TrackCard';
import { AlbumCard } from './AlbumCard';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track, Album } from '@/types/subsonic';

interface AlbumGridProps {
  items: Track[] | Album[];
  type: 'track' | 'album';
  isLoading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

function SkeletonCard() {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 animate-pulse">
      <div className="aspect-square rounded-2xl bg-white/10 mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

export function AlbumGrid({ items, type, isLoading = false }: AlbumGridProps) {
  const { setQueue } = usePlayerStore();
  const { openAlbum } = useUIStore();
  
  const handlePlayTrack = useCallback((index: number) => {
    setQueue(items as Track[], index);
    usePlayerStore.getState().play();
  }, [items, setQueue]);
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/50 text-lg">Ничего не найдено</p>
      </div>
    );
  }
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
    >
      {items.map((item, index) => (
        <motion.div key={item.id} variants={itemVariants}>
          {type === 'album' ? (
            <AlbumCard
              album={item as Album}
              onClick={() => openAlbum(item.id)}
            />
          ) : (
            <TrackCard 
              track={item as Track} 
              onPlay={() => handlePlayTrack(index)} 
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
