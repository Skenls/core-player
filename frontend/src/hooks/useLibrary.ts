import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { AlbumListType } from '@/api/library';
import type { AlbumWithSongs } from '@/types/subsonic';
import {
  deduplicateAlbums,
  getAlbumSplitIds,
  mergeAlbumSongs,
  deduplicateArtists,
  getArtistCollabIds,
} from '@/lib/libraryUtils';

export function useAlbums(type: AlbumListType = 'newest', size: number = 50) {
  return useQuery({
    queryKey: ['albums', type, size],
    queryFn: async () => {
      const albums = await api.library.getAlbums(type, size);
      return deduplicateAlbums(albums);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
}

export function useAlbumDetails(albumId: string | null) {
  return useQuery({
    queryKey: ['album', albumId],
    queryFn: async () => {
      if (!albumId) return null;
      const splitIds = getAlbumSplitIds(albumId);
      if (splitIds.length <= 1) {
        return api.library.getAlbum(albumId);
      }

      // Concurrently fetch all split parts of this album
      const albumResults = await Promise.all(
        splitIds.map((id) => api.library.getAlbum(id).catch(() => null))
      );
      const validAlbums = albumResults.filter((a): a is AlbumWithSongs => Boolean(a));
      return mergeAlbumSongs(validAlbums) || api.library.getAlbum(albumId);
    },
    enabled: !!albumId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useArtists() {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const artists = await api.library.getArtists();
      return deduplicateArtists(artists);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000,
  });
}

export function useArtistDetails(artistId: string | null) {
  return useQuery({
    queryKey: ['artist', artistId],
    queryFn: async () => {
      if (!artistId) return null;
      const mainArtist = await api.library.getArtist(artistId);
      const collabIds = getArtistCollabIds(artistId);

      if (collabIds.length === 0) {
        return {
          ...mainArtist,
          album: deduplicateAlbums(mainArtist.album || []),
        };
      }

      // Fetch collab/duo entries to include duo albums under each artist
      const collabResults = await Promise.all(
        collabIds.map((id) => api.library.getArtist(id).catch(() => null))
      );

      const allAlbums = [...(mainArtist.album || [])];
      for (const c of collabResults) {
        if (c?.album) {
          allAlbums.push(...c.album);
        }
      }

      const unifiedAlbums = deduplicateAlbums(allAlbums);
      return {
        ...mainArtist,
        album: unifiedAlbums,
        albumCount: unifiedAlbums.length,
      };
    },
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
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: async () => {
      const results = await api.library.search(trimmed);
      return {
        ...results,
        album: results.album ? deduplicateAlbums(results.album) : [],
        artist: results.artist ? deduplicateArtists(results.artist) : [],
      };
    },
    enabled: trimmed.length >= 2,
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
