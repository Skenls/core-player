import type { Album, Artist, Track, AlbumWithSongs } from '@/types/subsonic';
import { cleanArtistName, isFioSegment } from './formatters';

export interface UnifiedAlbum extends Album {
  splitIds?: string[];
}

// Global registry mapping any album ID to all companion split album IDs
const albumSplitMap = new Map<string, string[]>();

// Global registry mapping primary artist ID to any companion collab artist IDs (e.g. Kai Angel -> [Kai Angel, 9mice ID])
const artistCollabMap = new Map<string, string[]>();

/**
 * Normalizes an album key using title, cleaned artist, and year/cover when present.
 */
function getAlbumGroupKey(album: Album): string {
  const normTitle = (album.name || '').trim().toLowerCase();
  const cleanedArtist = cleanArtistName(album.artist).toLowerCase();
  
  // If year is available, include it to differentiate distinct releases with same name
  const yearKey = album.year ? `_y${album.year}` : '';
  
  // Notice: If artists are features/duos (e.g. "Kai Angel" and "Kai Angel, 9mice"),
  // they share the same album release title and should be grouped together.
  // We extract the primary artist token to group features of the same release:
  const primaryArtistToken = cleanedArtist.split(/[,&/]|feat|ft/)[0]?.trim() || '';
  
  // If coverArt is identical across splits, that's a strong release identifier
  const coverKey = album.coverArt ? `_cov${album.coverArt}` : '';

  if (coverKey) {
    return `${normTitle}${coverKey}`;
  }
  
  return `${normTitle}_${primaryArtistToken}${yearKey}`;
}

/**
 * Deduplicates albums that have been split across multiple artist tags in Navidrome / Subsonic.
 * Merges track counts, durations, and preserves companion split IDs.
 */
export function deduplicateAlbums(albums: Album[]): UnifiedAlbum[] {
  if (!albums || albums.length === 0) return [];

  const groups = new Map<string, UnifiedAlbum>();

  for (const album of albums) {
    const key = getAlbumGroupKey(album);
    const existing = groups.get(key);

    if (!existing) {
      const unified: UnifiedAlbum = {
        ...album,
        splitIds: [album.id],
      };
      groups.set(key, unified);
      albumSplitMap.set(album.id, [album.id]);
    } else {
      // Merge counts
      existing.songCount = (existing.songCount || 0) + (album.songCount || 0);
      existing.duration = (existing.duration || 0) + (album.duration || 0);
      
      if (!existing.splitIds) {
        existing.splitIds = [existing.id];
      }
      if (!existing.splitIds.includes(album.id)) {
        existing.splitIds.push(album.id);
      }
      
      // Update coverArt if existing didn't have one
      if (!existing.coverArt && album.coverArt) {
        existing.coverArt = album.coverArt;
      }
      // Update year if existing didn't have one
      if (!existing.year && album.year) {
        existing.year = album.year;
      }

      // Prefer cleaner / solo artist name as primary display
      const currentArtistClean = cleanArtistName(existing.artist);
      const newArtistClean = cleanArtistName(album.artist);
      const currentHasComma = currentArtistClean.includes(',') || currentArtistClean.includes('&');
      const newHasComma = newArtistClean.includes(',') || newArtistClean.includes('&');

      if (currentHasComma && !newHasComma) {
        existing.id = album.id;
        existing.artist = album.artist;
      } else if (existing.artistId && !album.artistId) {
        // Keep existing
      } else if (!existing.artistId && album.artistId) {
        existing.artistId = album.artistId;
      }
    }
  }

  const result = Array.from(groups.values());

  // Update albumSplitMap for every splitId in all groups
  for (const group of result) {
    if (group.splitIds && group.splitIds.length > 0) {
      for (const id of group.splitIds) {
        albumSplitMap.set(id, group.splitIds);
      }
    }
  }

  return result;
}

/**
 * Returns all split IDs associated with an album ID.
 */
export function getAlbumSplitIds(albumId: string): string[] {
  return albumSplitMap.get(albumId) || [albumId];
}

/**
 * Splits compound artist strings like "Kai Angel, 9mice", "Kai Angel & 9mice",
 * "Kai Angel feat. 9mice" into individual artist names.
 */
export function splitArtistNames(name?: string | null): string[] {
  if (!name) return [];
  const cleaned = cleanArtistName(name);
  if (!cleaned) return [];

  const parts = cleaned.split(/(?:,\s*|\s+&\s+|\s+(?:feat\.?|ft\.?|featuring|with|x)\s+|\s+\/\s+)/i);
  return parts
    .map((p) => cleanArtistName(p.trim()))
    .filter((p) => p.length > 0 && !isFioSegment(p));
}

/**
 * Deduplicates and cleans artists list:
 * - Filters out legal names / FIO (both Russian and Latin transliterations)
 * - Detects duos/features (e.g. "Kai Angel, 9mice") and links their albums to the primary solo artists
 * - Prevents fragmented duplicate entries in the artists directory
 */
export function deduplicateArtists(artists: Artist[]): Artist[] {
  if (!artists || artists.length === 0) return [];

  // 1. Filter out pure FIO segments
  const validArtists = artists.filter((a) => {
    if (!a.name || isFioSegment(a.name)) return false;
    return true;
  });

  // 2. Identify solo artist names
  const soloArtistMap = new Map<string, Artist>();
  for (const a of validArtists) {
    const clean = cleanArtistName(a.name).trim();
    const parts = splitArtistNames(clean);
    // If it's a single artist name (not compound)
    if (parts.length <= 1) {
      soloArtistMap.set(clean.toLowerCase(), a);
    }
  }

  // 3. Process compound artists and populate artistCollabMap
  const filtered: Artist[] = [];
  const seenIds = new Set<string>();

  for (const a of validArtists) {
    const clean = cleanArtistName(a.name).trim();
    const parts = splitArtistNames(clean);

    if (parts.length > 1) {
      // Check if at least one of the constituent artists exists as a solo artist
      const matchingSolos = parts
        .map((part) => soloArtistMap.get(part.toLowerCase()))
        .filter((solo): solo is Artist => Boolean(solo));

      if (matchingSolos.length > 0) {
        // Link this collab artist ID to all constituent solo artists
        for (const solo of matchingSolos) {
          const collabs = artistCollabMap.get(solo.id) || [];
          if (!collabs.includes(a.id)) {
            collabs.push(a.id);
            artistCollabMap.set(solo.id, collabs);
          }
        }
        // Do NOT add the compound duo as a separate standalone artist card
        continue;
      }
    }

    if (!seenIds.has(a.id)) {
      seenIds.add(a.id);
      filtered.push({
        ...a,
        name: cleanArtistName(a.name) || a.name,
      });
    }
  }

  return filtered;
}

/**
 * Returns any associated collab artist IDs for a given solo artist ID.
 */
export function getArtistCollabIds(artistId: string): string[] {
  return artistCollabMap.get(artistId) || [];
}

/**
 * Merges multiple album objects with songs into one unified AlbumWithSongs.
 */
export function mergeAlbumSongs(albums: AlbumWithSongs[]): AlbumWithSongs | null {
  if (!albums || albums.length === 0) return null;
  const primary = albums[0];
  if (albums.length === 1) return primary;

  const seenTrackIds = new Set<string>();
  const allTracks: Track[] = [];

  for (const alb of albums) {
    if (alb?.song) {
      for (const track of alb.song) {
        if (!seenTrackIds.has(track.id)) {
          seenTrackIds.add(track.id);
          allTracks.push(track);
        }
      }
    }
  }

  // Sort tracks by disc number and track number
  allTracks.sort((a, b) => {
    const discA = (a as any).discNumber || 1;
    const discB = (b as any).discNumber || 1;
    if (discA !== discB) return discA - discB;
    return (a.track || 0) - (b.track || 0);
  });

  return {
    ...primary,
    song: allTracks,
    songCount: allTracks.length,
    duration: allTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
  };
}
