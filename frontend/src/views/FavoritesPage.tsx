'use client';

import { useState } from 'react';
import { AlbumGrid } from '@/components/library/AlbumGrid';
import { TrackCard } from '@/components/library/TrackCard';
import { useFavoriteTracks, useFavoriteAlbums } from '@/hooks/useFavorites';
import { usePlayerStore } from '@/store/playerStore';
import { Heart, Music, Disc3 } from 'lucide-react';
import type { Track } from '@/types/subsonic';

export function FavoritesPage() {
  const [tab, setTab] = useState<'tracks' | 'albums'>('tracks');
  const { data: favoriteTracks, isLoading: isTracksLoading } = useFavoriteTracks();
  const { data: favoriteAlbums, isLoading: isAlbumsLoading } = useFavoriteAlbums();
  const { setCurrentTrack, play, setQueue } = usePlayerStore();

  const handlePlayTrack = (track: Track, index: number) => {
    if (favoriteTracks) {
      setQueue(favoriteTracks, index);
    }
    setCurrentTrack(track);
    play();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Избранное</h1>
        <p className="text-white/50">Ваша персональная коллекция музыки</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-white/10 pb-4">
        <button
          onClick={() => setTab('tracks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'tracks'
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Треки ({favoriteTracks?.length ?? 0})</span>
        </button>

        <button
          onClick={() => setTab('albums')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'albums'
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Disc3 className="w-4 h-4" />
          <span>Альбомы ({favoriteAlbums?.length ?? 0})</span>
        </button>
      </div>

      {/* Content */}
      {tab === 'tracks' && (
        <>
          {isTracksLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : !favoriteTracks || favoriteTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Heart className="w-16 h-16 text-white/20" />
              <div className="text-center">
                <p className="text-white/50 text-lg mb-2">Любимых треков пока нет</p>
                <p className="text-white/30 text-sm">
                  Нажимайте на сердечко у любых треков, чтобы сохранить их здесь
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {favoriteTracks.map((track, idx) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onPlay={() => handlePlayTrack(track, idx)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'albums' && (
        <>
          {!isAlbumsLoading && (!favoriteAlbums || favoriteAlbums.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Disc3 className="w-16 h-16 text-white/20" />
              <div className="text-center">
                <p className="text-white/50 text-lg mb-2">Любимых альбомов пока нет</p>
                <p className="text-white/30 text-sm">
                  Отмечайте альбомы, чтобы они появились в этой вкладке
                </p>
              </div>
            </div>
          ) : (
            <AlbumGrid items={favoriteAlbums || []} isLoading={isAlbumsLoading} type="album" />
          )}
        </>
      )}
    </div>
  );
}
