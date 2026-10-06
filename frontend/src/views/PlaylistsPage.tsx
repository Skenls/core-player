'use client';

import { motion } from 'framer-motion';
import { usePlaylists } from '@/hooks/useLibrary';
import { Music, ListMusic } from 'lucide-react';

export function PlaylistsPage() {
  const { data: playlists, isLoading } = usePlaylists();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/50 text-lg">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Плейлисты</h1>
        <p className="text-white/50">Ваши подборки</p>
      </div>
      
      {playlists && playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.02 }}
              className="group cursor-pointer"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 mb-4">
                {playlist.coverArt ? (
                  <img
                    src={`/api/stream/cover/${playlist.coverArt}?size=300`}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListMusic className="w-16 h-16 text-white/30" />
                  </div>
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white text-sm">Открыть</div>
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-medium truncate mb-1">
                  {playlist.name}
                </h3>
                <p className="text-white/50 text-sm">
                  {playlist.songCount || 0} треков
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Music className="w-16 h-16 text-white/20" />
          <div className="text-center">
            <p className="text-white/50 text-lg mb-2">Плейлисты не найдены</p>
            <p className="text-white/30 text-sm">
              Создайте плейлист в Navidrome
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
