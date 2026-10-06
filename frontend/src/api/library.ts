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

export type AlbumListType = 'recent' | 'frequent' | 'random' | 'newest' | 'starred';

export const libraryApi = {
  /**
   * Get list of albums
   */
  async getAlbums(type: AlbumListType = 'recent', size: number = 50): Promise<Album[]> {
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
   * Get playlist details with tracks
   */
  async getPlaylist(id: string): Promise<PlaylistWithSongs> {
    const { data } = await axiosClient.get<{ playlist: PlaylistWithSongs }>(
      `/library/playlists/${id}`
    );
    return data.playlist;
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
   * Star/favorite a track, album, or artist
   */
  async star(id: string, type: 'track' | 'album' | 'artist'): Promise<void> {
    await axiosClient.post('/library/star', { id, type });
  },

  /**
   * Unstar/unfavorite a track, album, or artist
   */
  async unstar(id: string, type: 'track' | 'album' | 'artist'): Promise<void> {
    await axiosClient.post('/library/unstar', { id, type });
  },

  /**
   * Scrobble a track (mark as played)
   */
  async scrobble(id: string, time?: number): Promise<void> {
    await axiosClient.post('/library/scrobble', { id, time });
  },
};
