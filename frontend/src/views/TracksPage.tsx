'use client';

import { AlbumGrid } from '@/components/library/AlbumGrid';
import { useRandomTracks } from '@/hooks/useLibrary';

export function TracksPage() {
  const { data: tracks, isLoading } = useRandomTracks(100);
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Треки</h1>
        <p className="text-white/50">Все ваши треки</p>
      </div>
      
      <AlbumGrid 
        items={tracks || []} 
        isLoading={isLoading}
        type="track"
      />
    </div>
  );
}
