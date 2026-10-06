'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ListMusic, Check } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { Track } from '@/types/subsonic';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

export function AddToPlaylistModal({ isOpen, onClose, track }: AddToPlaylistModalProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.library.getPlaylists(),
    enabled: isOpen,
  });

  const addTrackMutation = useMutation({
    mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      api.library.addTrackToPlaylist(playlistId, trackId),
    onSuccess: (_data, vars) => {
      setAddedPlaylistId(vars.playlistId);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setTimeout(() => {
        setAddedPlaylistId(null);
        onClose();
      }, 700);
    },
  });

  const createAndAddMutation = useMutation({
    mutationFn: async (name: string) => {
      const pl = await api.library.createPlaylist(name);
      if (track) {
        await api.library.addTrackToPlaylist(pl.id, track.id);
      }
      return pl;
    },
    onSuccess: (pl) => {
      setAddedPlaylistId(pl.id);
      setNewPlaylistName('');
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setTimeout(() => {
        setAddedPlaylistId(null);
        onClose();
      }, 700);
    },
  });

  if (!isOpen || !track) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-[#16181f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div>
              <h3 className="font-semibold text-white">Добавить в плейлист</h3>
              <p className="text-xs text-white/50 truncate max-w-[280px]">
                {track.title} — {track.artist}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Playlist Form */}
          <div className="p-4 border-b border-white/5 bg-black/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newPlaylistName.trim()) {
                  createAndAddMutation.mutate(newPlaylistName.trim());
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Новый плейлист..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim() || createAndAddMutation.isPending}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Создать</span>
              </button>
            </form>
          </div>

          {/* Existing Playlists List */}
          <div className="p-3 overflow-y-auto flex-1 space-y-1">
            {isLoading ? (
              <p className="text-center py-6 text-sm text-white/40">Загрузка плейлистов...</p>
            ) : !playlists || playlists.length === 0 ? (
              <p className="text-center py-6 text-sm text-white/40">Плейлистов пока нет</p>
            ) : (
              playlists.map((pl) => {
                const isJustAdded = addedPlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    onClick={() => addTrackMutation.mutate({ playlistId: pl.id, trackId: track.id })}
                    disabled={addTrackMutation.isPending || isJustAdded}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 text-white/60 group-hover:text-white">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{pl.name}</div>
                        <div className="text-xs text-white/40">{pl.songCount ?? 0} треков</div>
                      </div>
                    </div>

                    {isJustAdded && (
                      <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
                        <Check className="w-4 h-4" />
                        <span>Добавлено</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
