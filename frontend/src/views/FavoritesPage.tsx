'use client';

import { AlbumGrid } from '@/components/library/AlbumGrid';
import { useAlbums } from '@/hooks/useLibrary';
import { Heart } from 'lucide-react';

export function FavoritesPage() {
  const { data: albums, isLoading } = useAlbums('starred', 100);
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Избранное</h1>
        <p className="text-white/50">Отмеченные альбомы</p>
      </div>
      
      {!isLoading && (!albums || albums.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Heart className="w-16 h-16 text-white/20" />
          <div className="text-center">
            <p className="text-white/50 text-lg mb-2">Избранного пока нет</p>
            <p className="text-white/30 text-sm">
              Отмечайте альбомы в Navidrome, чтобы они появились здесь
            </p>
          </div>
        </div>
      ) : (
        <AlbumGrid items={albums || []} isLoading={isLoading} type="album" />
      )}
    </div>
  );
}
