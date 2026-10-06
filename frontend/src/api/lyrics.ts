import { axiosClient } from './client';
import type { LyricsData } from '@/types/subsonic';

export const lyricsApi = {
  /**
   * Get lyrics for a track (with fallback chain)
   */
  async getLyrics(
    trackId: string,
    artist: string,
    title: string,
    album?: string,
    duration?: number
  ): Promise<LyricsData> {
    const { data } = await axiosClient.get<LyricsData>(`/lyrics/${trackId}`, {
      params: { artist, title, album, duration },
    });
    return data;
  },
};
