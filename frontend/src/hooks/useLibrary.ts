import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { AlbumListType } from '@/api/library';

export function useAlbums(type: AlbumListType = 'recent', size: number = 50) {
  return useQuery({
    queryKey: ['albums', type, size],
    queryFn: () => api.library.getAlbums(type, size),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
}

export function useAlbumDetails(albumId: string | null) {
  return useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.library.getAlbum(albumId!),
    enabled: !!albumId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: () => api.library.getArtists(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,
  });
}

export function useArtistDetails(artistId: string | null) {
  return useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => api.library.getArtist(artistId!),
    enabled: !!artistId,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePlaylists() {
  return useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.library.getPlaylists(),
    staleTime: 60 * 1000,
  });
}

export function usePlaylistDetails(playlistId: string | null) {
  return useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.library.getPlaylist(playlistId!),
    enabled: !!playlistId,
    staleTime: 60 * 1000,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.library.search(query),
    enabled: query.length > 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useRandomTracks(size: number = 50) {
  return useQuery({
    queryKey: ['random', size],
    queryFn: () => api.library.getRandomTracks(size),
    staleTime: 5 * 60 * 1000, // 5 minutes to prevent re-querying and flickering on navigation
    gcTime: 15 * 60 * 1000,
  });
}

// Mutations
export function useStarMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'track' | 'album' | 'artist' }) =>
      api.library.star(id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    },
  });
}

export function useUnstarMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'track' | 'album' | 'artist' }) =>
      api.library.unstar(id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    },
  });
}

export function useScrobbleMutation() {
  return useMutation({
    mutationFn: ({ id, time }: { id: string; time?: number }) =>
      api.library.scrobble(id, time),
  });
}
