/**
 * Core Subsonic API types based on API version 1.16.1
 */

export interface SubsonicResponse<T = any> {
  'subsonic-response': {
    status: 'ok' | 'failed';
    version: string;
    error?: {
      code: number;
      message: string;
    };
  } & T;
}

export interface Track {
  id: string;
  parent: string;
  title: string;
  album: string;
  artist: string;
  isDir: boolean;
  coverArt?: string;
  created: string;
  duration: number;
  bitRate?: number;
  track?: number;
  year?: number;
  genre?: string;
  size: number;
  suffix: string;
  contentType: string;
  isVideo: boolean;
  path: string;
  albumId: string;
  artistId: string;
  type: 'music';
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  songCount: number;
  duration: number;
  created: string;
  year?: number;
  genre?: string;
}

export interface AlbumWithSongs extends Album {
  song: Track[];
}

export interface Artist {
  id: string;
  name: string;
  coverArt?: string;
  albumCount: number;
}

export interface ArtistWithAlbums extends Artist {
  album: Album[];
}

export interface Playlist {
  id: string;
  name: string;
  comment?: string;
  owner: string;
  public: boolean;
  songCount: number;
  duration: number;
  created: string;
  changed: string;
  coverArt?: string;
}

export interface PlaylistWithSongs extends Playlist {
  entry: Track[];
}

export interface SearchResult3 {
  artist?: Artist[];
  album?: Album[];
  song?: Track[];
}

export interface Lyrics {
  artist?: string;
  title?: string;
  value: string;
}

export interface User {
  username: string;
  email?: string;
  scrobblingEnabled: boolean;
  adminRole: boolean;
  settingsRole: boolean;
  downloadRole: boolean;
  uploadRole: boolean;
  playlistRole: boolean;
  coverArtRole: boolean;
  commentRole: boolean;
  podcastRole: boolean;
  streamRole: boolean;
  jukeboxRole: boolean;
  shareRole: boolean;
}

// Frontend-specific types
export interface LyricsData {
  text: string;
  synced: boolean;
  lines: Array<{
    time: number;
    text: string;
  }> | null;
}
