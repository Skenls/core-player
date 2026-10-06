'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePlaylists, usePlaylistDetails } from '@/hooks/useLibrary';
import { usePlayerStore } from '@/store/playerStore';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/api';
import { Music, ListMusic, Plus, Play, ArrowLeft, Trash2 } from 'lucide-react';
import type { Track } from '@/types/subsonic';

export function PlaylistsPage() {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  const queryClient = useQueryClient();
  const { data: playlists, isLoading } = usePlaylists();
  const { data: playlistDetails, isLoading: isDetailsLoading } = usePlaylistDetails(selectedPlaylistId);
  const { setCurrentTrack, play, setQueue } = usePlayerStore();

  const createPlaylistMutation = useMutation({
    mutationFn: (name: string) => api.library.createPlaylist(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setNewPlaylistName('');
      setIsCreating(false);
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: (id: string) => api.library.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setSelectedPlaylistId(null);
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: ({ plId, trackId }: { plId: string; trackId: string }) =>
      api.library.removeTrackFromPlaylist(plId, trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', selectedPlaylistId] });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });

  const handlePlayPlaylist = (tracks: Track[], startIndex: number = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks, startIndex);
    setCurrentTrack(tracks[startIndex]);
    play();
  };

  const formatDuration = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // If a playlist is selected, show details view
  if (selectedPlaylistId) {
    const pl = playlistDetails;
    const tracks = pl?.entry || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Назад ко всем плейлистам</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Удалить этот плейлист?')) {
                deletePlaylistMutation.mutate(selectedPlaylistId);
              }
            }}
            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            title="Удалить плейлист"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {isDetailsLoading ? (
          <div className="text-white/40 py-12 text-center">Загрузка треков...</div>
        ) : !pl ? (
          <div className="text-white/40 py-12 text-center">Плейлист не найден</div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-end gap-6">
              <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center shadow-2xl flex-shrink-0">
                <ListMusic className="w-20 h-20 text-white/40" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Плейлист
                </span>
                <h1 className="text-4xl font-bold text-white tracking-tight">{pl.name}</h1>
                <p className="text-sm text-white/50">{tracks.length} треков</p>
                {tracks.length > 0 && (
                  <button
                    onClick={() => handlePlayPlaylist(tracks, 0)}
                    className="mt-2 px-6 py-2.5 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors flex items-center gap-2 shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Слушать</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tracks List */}
            {tracks.length === 0 ? (
              <div className="py-12 text-center text-white/40">
                В этом плейлисте пока нет треков. Добавляйте треки кликом на «+» в плеере или карточке!
              </div>
            ) : (
              <div className="divide-y divide-white/5 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
                {tracks.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => handlePlayPlaylist(tracks, idx)}
                    className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                      <span className="w-6 text-center text-xs font-mono text-white/30 group-hover:text-white">
                        {idx + 1}
                      </span>
                      {t.coverArt && (
                        <img
                          src={`/api/stream/cover/${t.coverArt}?size=64`}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="truncate flex-1">
                        <div className="text-sm font-medium text-white truncate">{t.title}</div>
                        <div className="text-xs text-white/50 truncate">{t.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-white/40">
                        {formatDuration(t.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackMutation.mutate({ plId: selectedPlaylistId, trackId: t.id });
                        }}
                        className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Удалить из плейлиста"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // All playlists view
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Плейлисты</h1>
          <p className="text-white/50">Ваши персональные подборки треков</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-white/10"
        >
          <Plus className="w-4 h-4" />
          <span>Создать плейлист</span>
        </button>
      </div>

      {/* Inline Create Form */}
      {isCreating && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-w-md space-y-3">
          <h3 className="text-sm font-medium text-white">Новый плейлист</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPlaylistName.trim()) {
                createPlaylistMutation.mutate(newPlaylistName.trim());
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Название плейлиста..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 text-white/50 hover:text-white text-sm rounded-xl"
            >
              Отмена
            </button>
          </form>
        </div>
      )}

      {/* Grid of playlists */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-white/50 text-lg">Загрузка...</div>
        </div>
      ) : playlists && playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedPlaylistId(playlist.id)}
              className="group cursor-pointer"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 mb-4 flex items-center justify-center group-hover:border-white/20 transition-all shadow-lg">
                <ListMusic className="w-16 h-16 text-white/40 group-hover:text-white/70 transition-colors" />
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                    <Play className="w-5 h-5 ml-0.5 fill-white" />
                  </div>
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
            <p className="text-white/50 text-lg mb-2">Плейлистов пока нет</p>
            <p className="text-white/30 text-sm">
              Нажмите «Создать плейлист» выше, чтобы собрать любимые треки
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
