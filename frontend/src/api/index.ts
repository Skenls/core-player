import { authApi } from './auth';
import { libraryApi } from './library';
import { lyricsApi } from './lyrics';

export { axiosClient } from './client';
export { authApi } from './auth';
export { libraryApi } from './library';
export { lyricsApi } from './lyrics';

// Unified API object
export const api = {
  auth: authApi,
  library: libraryApi,
  lyrics: lyricsApi,
};

// Helper functions for cover art and streaming
export const getCoverArtUrl = (coverArtId: string, size: number = 300): string => {
  return `/api/stream/cover/${coverArtId}?size=${size}`;
};

export const getStreamUrl = (trackId: string): string => {
  return `/api/stream/${trackId}`;
};
