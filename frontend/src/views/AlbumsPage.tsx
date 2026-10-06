'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play } from 'lucide-react';
import { useAlbums, useAlbumDetails } from '@/hooks/useLibrary';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function AlbumsPage() {
  const { data: albums, isLoading } = useAlbums('recent', 100);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  
  const { data: albumDetails } = useAlbumDetails(selectedAlbumId);
  const { setQueue } = usePlayerStore();
  const { openNowPlaying } = useUIStore();
  
  const handlePlayAlbum = () => {
    if (albumDetails?.song && albumDetails.song.length > 0) {
      setQueue(albumDetails.song, 0);
      usePlayerStore.getState().play();
      openNowPlaying();
    }
  };
  
  const handlePlayTrack = (index: number) => {
    if (albumDetails?.song) {
      setQueue(albumDetails.song, index);
      usePlayerStore.getState().play();
      openNowPlaying();
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
          onClick={() => setSelectedAlbumId(null)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Назад к альбомам</span>
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
              <p className="text-white/70 text-xl">{albumDetails.artist}</p>
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
                <p className="text-white/50 text-sm truncate">{track.artist}</p>
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
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Альбомы</h1>
        <p className="text-white/50">Ваша коллекция альбомов</p>
      </div>
      
      <div 
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
      >
        {albums?.map((album) => (
          <motion.div
            key={album.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedAlbumId(album.id)}
            className="group cursor-pointer"
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-4">
              {album.coverArt && (
                <img
                  src={`/api/stream/cover/${album.coverArt}?size=300`}
                  alt={album.name}
                  className="w-full h-full object-cover"
                />
              )}
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-sm">Открыть</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-medium truncate">{album.name}</h3>
              <p className="text-white/50 text-sm truncate">{album.artist}</p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-white/50 text-lg">Загрузка...</div>
        </div>
      )}
    </div>
  );
}
