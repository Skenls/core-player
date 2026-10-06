import { authApi } from './auth';
import { libraryApi } from './library';
import { lyricsApi } from './lyrics';
import { adminApi } from './admin';

export { axiosClient } from './client';
export { authApi } from './auth';
export { libraryApi } from './library';
export { lyricsApi } from './lyrics';
export { adminApi } from './admin';

// Unified API object
export const api = {
  auth: authApi,
  library: libraryApi,
  lyrics: lyricsApi,
  admin: adminApi,
};

// Helper functions for cover art and streaming
export const getCoverArtUrl = (coverArtId: string, size: number = 300): string => {
  return `/api/stream/cover/${coverArtId}?size=${size}`;
};

export const getStreamUrl = (trackId: string, format?: string): string => {
  return format ? `/api/stream/${trackId}?format=${format}` : `/api/stream/${trackId}`;
};
