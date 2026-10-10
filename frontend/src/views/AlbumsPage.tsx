import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Disc } from 'lucide-react';
import { useAlbums, useAlbumDetails } from '@/hooks/useLibrary';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { AlbumCard } from '@/components/library/AlbumCard';
import { cleanArtistName } from '@/lib/formatters';
import type { AlbumListType } from '@/api/library';

export function AlbumsPage() {
  const [sortType, setSortType] = useState<AlbumListType>('newest');
  const { data: albums, isLoading } = useAlbums(sortType, 100);
  const { selectedAlbumId, openAlbum, closeAlbum } = useUIStore();
  
  const { data: albumDetails } = useAlbumDetails(selectedAlbumId);
  const { setQueue } = usePlayerStore();
  
  const handlePlayAlbum = () => {
    if (albumDetails?.song && albumDetails.song.length > 0) {
      setQueue(albumDetails.song, 0);
      usePlayerStore.getState().play();
    }
  };
  
  const handlePlayTrack = (index: number) => {
    if (albumDetails?.song) {
      setQueue(albumDetails.song, index);
      usePlayerStore.getState().play();
    }
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // If album is selected, show details
  if (selectedAlbumId && albumDetails) {
    return (
      <div className="space-y-8">
        {/* Back button */}
        <button
          onClick={closeAlbum}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Назад</span>
        </button>
        
        {/* Album header */}
        <div className="flex items-start gap-8">
          <div className="w-64 h-64 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 shadow-2xl">
            {albumDetails.coverArt && (
              <img
                src={`/api/stream/cover/${albumDetails.coverArt}?size=600`}
                alt={albumDetails.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-white/50 text-sm uppercase tracking-wider mb-2">Альбом</p>
              <h1 className="text-5xl font-bold text-white mb-3">{albumDetails.name}</h1>
              <p className="text-white/70 text-xl">{cleanArtistName(albumDetails.artist)}</p>
            </div>
            
            <div className="flex items-center gap-4 text-white/50 text-sm">
              {albumDetails.year && <span>{albumDetails.year}</span>}
              {albumDetails.songCount && <span>• {albumDetails.songCount} треков</span>}
              {albumDetails.duration && (
                <span>• {Math.floor(albumDetails.duration / 60)} мин</span>
              )}
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlayAlbum}
              className="flex items-center gap-3 px-8 py-4 bg-white hover:bg-white/90 rounded-full text-black font-semibold transition-colors"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>Воспроизвести</span>
            </motion.button>
          </div>
        </div>
        
        {/* Tracklist */}
        <div className="space-y-2">
          {albumDetails.song?.map((track, index) => (
            <motion.button
              key={track.id}
              whileHover={{ x: 4 }}
              onClick={() => handlePlayTrack(index)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all group text-left"
            >
              <span className="text-white/50 text-sm font-mono w-8 text-right">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{track.title}</p>
                <p className="text-white/50 text-sm truncate">{cleanArtistName(track.artist)}</p>
              </div>
              
              <span className="text-white/50 text-sm font-mono">
                {formatDuration(track.duration || 0)}
              </span>
              
              <Play className="w-4 h-4 text-white/0 group-hover:text-white/70 transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }
  
  // Main albums grid
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Альбомы</h1>
          <p className="text-white/50">Ваша коллекция альбомов</p>
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl self-start">
          <button
            onClick={() => setSortType('newest')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              sortType === 'newest'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Новые
          </button>
          <button
            onClick={() => setSortType('alphabeticalByName')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              sortType === 'alphabeticalByName'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            По алфавиту
          </button>
          <button
            onClick={() => setSortType('random')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              sortType === 'random'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Случайные
          </button>
          <button
            onClick={() => setSortType('recent')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              sortType === 'recent'
                ? 'bg-blue-600 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Недавние
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-4 animate-pulse">
              <div className="aspect-square rounded-2xl bg-white/10 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (!albums || albums.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/40">
          <Disc className="w-12 h-12 stroke-[1.5]" />
          <p className="text-lg font-medium">Альбомы не найдены</p>
        </div>
      ) : (
        <div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        >
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => openAlbum(album.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
