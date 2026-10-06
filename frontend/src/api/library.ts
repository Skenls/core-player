import { axiosClient } from './client';
import type {
  Album,
  AlbumWithSongs,
  Artist,
  ArtistWithAlbums,
  Track,
  Playlist,
  PlaylistWithSongs,
  SearchResult3,
} from '@/types/subsonic';

export type AlbumListType = 'recent' | 'frequent' | 'random' | 'newest' | 'starred' | 'alphabeticalByName';

export const libraryApi = {
  /**
   * Get list of albums
   */
  async getAlbums(type: AlbumListType = 'newest', size: number = 50): Promise<Album[]> {
    const { data } = await axiosClient.get<{ albums: Album[] }>('/library/albums', {
      params: { type, size },
    });
    return data.albums;
  },

  /**
   * Get album details with tracks
   */
  async getAlbum(id: string): Promise<AlbumWithSongs> {
    const { data } = await axiosClient.get<{ album: AlbumWithSongs }>(`/library/albums/${id}`);
    return data.album;
  },

  /**
   * Get all artists (indexed)
   */
  async getArtists(): Promise<Artist[]> {
    const { data } = await axiosClient.get<{ artists: Artist[] }>('/library/artists');
    return data.artists;
  },

  /**
   * Get artist details with albums
   */
  async getArtist(id: string): Promise<ArtistWithAlbums> {
    const { data } = await axiosClient.get<{ artist: ArtistWithAlbums }>(`/library/artists/${id}`);
    return data.artist;
  },

  /**
   * Get all playlists
   */
  async getPlaylists(): Promise<Playlist[]> {
    const { data } = await axiosClient.get<{ playlists: Playlist[] }>('/library/playlists');
    return data.playlists;
  },

  /**
   * Create new playlist
   */
  async createPlaylist(name: string): Promise<Playlist> {
    const { data } = await axiosClient.post<Playlist>('/library/playlists', { name });
    return data;
  },

  /**
   * Get playlist details with tracks
   */
  async getPlaylist(id: string): Promise<PlaylistWithSongs> {
    const { data } = await axiosClient.get<{ playlist: PlaylistWithSongs }>(
      `/library/playlists/${id}`
    );
    return data.playlist;
  },

  /**
   * Add a track to playlist
   */
  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    await axiosClient.post(`/library/playlists/${playlistId}/tracks`, { track_id: trackId });
  },

  /**
   * Remove a track from playlist
   */
  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await axiosClient.delete(`/library/playlists/${playlistId}/tracks/${trackId}`);
  },

  /**
   * Delete playlist
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    await axiosClient.delete(`/library/playlists/${playlistId}`);
  },

  /**
   * Search for tracks, albums, and artists
   */
  async search(query: string): Promise<SearchResult3> {
    const { data } = await axiosClient.get<{ results: SearchResult3 }>('/library/search', {
      params: { query },
    });
    return data.results;
  },

  /**
   * Get random tracks
   */
  async getRandomTracks(size: number = 50): Promise<Track[]> {
    const { data } = await axiosClient.get<{ tracks: Track[] }>('/library/random', {
      params: { size },
    });
    return data.tracks;
  },

  /**
   * Get all favorite IDs for current user
   */
  async getFavoriteIds(): Promise<{ tracks: string[]; albums: string[] }> {
    const { data } = await axiosClient.get<{ tracks: string[]; albums: string[] }>(
      '/library/favorites/ids'
    );
    return data;
  },

  /**
   * Toggle favorite
   */
  async toggleFavorite(id: string, type: 'track' | 'album'): Promise<{ starred: boolean; id: string; type: string }> {
    const { data } = await axiosClient.post<{ starred: boolean; id: string; type: string }>(
      '/library/favorites/toggle',
      { id, type }
    );
    return data;
  },

  /**
   * Get favorite tracks
   */
  async getFavoriteTracks(): Promise<Track[]> {
    const { data } = await axiosClient.get<{ tracks: Track[] }>('/library/favorites/tracks');
    return data.tracks;
  },

  /**
   * Get favorite albums
   */
  async getFavoriteAlbums(): Promise<Album[]> {
    const { data } = await axiosClient.get<{ albums: Album[] }>('/library/favorites/albums');
    return data.albums;
  },

  /**
   * Scrobble a track (mark as played)
   */
  async scrobble(id: string, time?: number): Promise<void> {
    await axiosClient.post('/library/scrobble', { id, time });
  },

  /**
   * Star/favorite
   */
  async star(id: string, type: 'track' | 'album' | 'artist'): Promise<void> {
    await axiosClient.post('/library/favorites/toggle', { id, type: type === 'album' ? 'album' : 'track' });
  },

  /**
   * Unstar/unfavorite
   */
  async unstar(id: string, type: 'track' | 'album' | 'artist'): Promise<void> {
    await axiosClient.post('/library/favorites/toggle', { id, type: type === 'album' ? 'album' : 'track' });
  },
};
