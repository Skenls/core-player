'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Play, Music2, ListMusic, Loader2 } from 'lucide-react';
import { AlbumGrid } from '@/components/library/AlbumGrid';
import { AlbumCard } from '@/components/library/AlbumCard';
import { useAlbums, useRandomTracks, useSearch, usePlaylists } from '@/hooks/useLibrary';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { cleanArtistName } from '@/lib/formatters';
import { deduplicateAlbums } from '@/lib/libraryUtils';
import type { Track } from '@/types/subsonic';

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query to reduce network and rendering churn
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: albums, isLoading: albumsLoading } = useAlbums('newest', 24);
  const { data: tracks, isLoading: tracksLoading } = useRandomTracks(50);
  const { data: playlists } = usePlaylists();
  const { data: searchResults, isLoading: isSearchLoading } = useSearch(debouncedQuery);

  const { setQueue, setCurrentTrack, play } = usePlayerStore();
  const { openAlbum, openArtist, openPlaylist } = useUIStore();

  const isSearching = debouncedQuery.length > 0;

  // Filtered tracks (combining server search + instant preloaded matches)
  const combinedTracks = useMemo(() => {
    if (!isSearching) return [];
    const q = debouncedQuery.toLowerCase();
    const seen = new Set<string>();
    const list: Track[] = [];

    // 1. From server search
    if (searchResults?.song) {
      for (const t of searchResults.song) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          list.push(t);
        }
      }
    }

    // 2. From local cached random tracks
    if (tracks) {
      for (const t of tracks) {
        if (
          !seen.has(t.id) &&
          (t.title?.toLowerCase().includes(q) ||
            cleanArtistName(t.artist)?.toLowerCase().includes(q) ||
            t.album?.toLowerCase().includes(q))
        ) {
          seen.add(t.id);
          list.push(t);
        }
      }
    }

    return list;
  }, [isSearching, debouncedQuery, searchResults, tracks]);

  // Filtered and deduplicated albums
  const combinedAlbums = useMemo(() => {
    if (!isSearching) return [];
    const q = debouncedQuery.toLowerCase();
    const all = [...(searchResults?.album || [])];

    if (albums) {
      for (const a of albums) {
        if (
          a.name?.toLowerCase().includes(q) ||
          cleanArtistName(a.artist)?.toLowerCase().includes(q)
        ) {
          all.push(a);
        }
      }
    }

    return deduplicateAlbums(all);
  }, [isSearching, debouncedQuery, searchResults, albums]);

  // Filtered artists (already deduplicated and FIO filtered by useSearch)
  const combinedArtists = useMemo(() => {
    if (!isSearching) return [];
    return searchResults?.artist || [];
  }, [isSearching, searchResults]);

  // Filtered playlists
  const combinedPlaylists = useMemo(() => {
    if (!isSearching || !playlists) return [];
    const q = debouncedQuery.toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [isSearching, debouncedQuery, playlists]);

  const hasResults =
    combinedTracks.length > 0 ||
    combinedAlbums.length > 0 ||
    combinedArtists.length > 0 ||
    combinedPlaylists.length > 0;

  const handlePlayTrack = (trackList: Track[], index: number) => {
    setQueue(trackList, index);
    setCurrentTrack(trackList[index]);
    play();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-10">
      {/* Header and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Главная</h1>
          <p className="text-white/50">Ваша музыкальная библиотека</p>
        </div>

        {/* Semi-transparent search bar */}
        <div className="relative w-full md:max-w-md">
          <div className="relative flex items-center bg-white/[0.06] hover:bg-white/[0.09] focus-within:bg-white/[0.12] border border-white/10 focus-within:border-white/25 rounded-2xl px-4 py-3 backdrop-blur-xl transition-all duration-200 shadow-lg">
            <Search className="w-5 h-5 text-white/40 mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Поиск"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white placeholder-white/40 text-base outline-none font-medium"
            />
            {isSearchLoading && debouncedQuery.length >= 2 && (
              <Loader2 className="w-4 h-4 text-white/40 animate-spin mr-2" />
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Очистить поиск"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isSearching ? (
          /* Search Results View */
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-12"
          >
            <div>
              <h2 className="text-2xl font-bold text-white">
                Результаты поиска: <span className="text-white/70 font-normal">«{debouncedQuery}»</span>
              </h2>
            </div>

            {/* Tracks Section */}
            {combinedTracks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Треки</h3>
                  <span className="text-sm text-white/40">{combinedTracks.length} найдено</span>
                </div>

                <div className="divide-y divide-white/5 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
                  {combinedTracks.slice(0, 15).map((track, idx) => {
                    const artistName = cleanArtistName(track.artist) || 'Неизвестный исполнитель';

                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlayTrack(combinedTracks, idx)}
                        className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                            {track.coverArt ? (
                              <img
                                src={`/api/stream/cover/${track.coverArt}?size=80`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music2 className="w-5 h-5 text-white/30" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                            </div>
                          </div>

                          <div className="truncate flex-1">
                            <div className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                              {track.title}
                            </div>
                            <div className="text-xs text-white/50 truncate">
                              {artistName}
                              {track.album && ` • ${track.album}`}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-white/40 flex-shrink-0">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Albums Section */}
            {combinedAlbums.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Альбомы</h3>
                  <span className="text-sm text-white/40">{combinedAlbums.length} найдено</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {combinedAlbums.slice(0, 12).map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => openAlbum(album.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Artists Section */}
            {combinedArtists.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Исполнители</h3>
                  <span className="text-sm text-white/40">{combinedArtists.length} найдено</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {combinedArtists.map((artist) => {
                    const artistName = cleanArtistName(artist.name) || artist.name;

                    return (
                      <motion.div
                        key={artist.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => openArtist(artist.id)}
                        className="group cursor-pointer bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-3xl p-4 text-center transition-all"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden bg-white/5 mx-auto mb-3 max-w-[140px]">
                          {artist.coverArt ? (
                            <img
                              src={`/api/stream/cover/${artist.coverArt}?size=240`}
                              alt={artistName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music2 className="w-10 h-10 text-white/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs text-white">Открыть</span>
                          </div>
                        </div>

                        <h4 className="font-medium text-white text-sm truncate" title={artistName}>
                          {artistName}
                        </h4>
                        <p className="text-xs text-white/40 mt-1">
                          {artist.albumCount ? `${artist.albumCount} альбомов` : 'Исполнитель'}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Playlists Section */}
            {combinedPlaylists.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Плейлисты</h3>
                  <span className="text-sm text-white/40">{combinedPlaylists.length} найдено</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {combinedPlaylists.map((playlist) => (
                    <motion.div
                      key={playlist.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => openPlaylist(playlist.id)}
                      className="group cursor-pointer bg-white/[0.04] border border-white/[0.08] hover:border-white/20 rounded-3xl p-4 transition-all"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 mb-3 flex items-center justify-center shadow-lg">
                        <ListMusic className="w-12 h-12 text-white/40 group-hover:text-white/70 transition-colors" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-6 h-6 fill-white text-white ml-0.5" />
                        </div>
                      </div>

                      <h4 className="font-medium text-white text-sm truncate mb-0.5">
                        {playlist.name}
                      </h4>
                      <p className="text-xs text-white/40">
                        {playlist.songCount || 0} треков
                      </p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state when nothing is found */}
            {!hasResults && !isSearchLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Search className="w-12 h-12 text-white/20 stroke-[1.5]" />
                <h3 className="text-lg font-medium text-white/70">
                  Ничего не найдено по запросу «{debouncedQuery}»
                </h3>
                <p className="text-sm text-white/40 max-w-sm">
                  Проверьте правильность написания или попробуйте другой поисковый запрос
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          /* Default Home View */
          <motion.div
            key="default-home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-12"
          >
            <section>
              <h2 className="text-2xl font-semibold text-white mb-6">Недавно добавленные</h2>
              <AlbumGrid 
                items={albums || []} 
                isLoading={albumsLoading}
                type="album"
              />
            </section>
            
            <section>
              <h2 className="text-2xl font-semibold text-white mb-6">Случайные треки</h2>
              <AlbumGrid 
                items={tracks || []} 
                isLoading={tracksLoading}
                type="track"
              />
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
