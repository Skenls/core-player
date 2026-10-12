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
 * Deduplicates albums that have been split across multiple artist tags in Navidrome / Subsonic.
 * Groups by normalized release title, checking for artist overlap or matching years.
 */
export function deduplicateAlbums(albums: Album[]): UnifiedAlbum[] {
  if (!albums || albums.length === 0) return [];

  const grouped: UnifiedAlbum[][] = [];

  for (const album of albums) {
    const title = (album.name || '').trim().toLowerCase();
    if (!title) continue;

    const artistRaw = (album.artist || '').trim();
    const year = album.year || 0;
    const artistTokens = splitArtistNames(artistRaw).map((a) => a.toLowerCase());

    let matchedGroup: UnifiedAlbum[] | null = null;

    for (const group of grouped) {
      const first = group[0];
      const firstTitle = (first.name || '').trim().toLowerCase();

      if (title === firstTitle) {
        const firstArtistRaw = (first.artist || '').trim();
        const firstYear = first.year || 0;
        const firstArtistTokens = splitArtistNames(firstArtistRaw).map((a) => a.toLowerCase());

        let overlap = false;
        if (artistTokens.length === 0 || firstArtistTokens.length === 0) {
          overlap = true;
        } else {
          for (const t of artistTokens) {
            if (firstArtistTokens.some((ft) => ft.includes(t) || t.includes(ft))) {
              overlap = true;
              break;
            }
          }
        }

        // If distinct different years AND zero artist overlap, treat as separate releases
        if (year && firstYear && year !== firstYear && !overlap) {
          continue;
        }

        matchedGroup = group;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.push(album as UnifiedAlbum);
    } else {
      grouped.push([album as UnifiedAlbum]);
    }
  }

  const result: UnifiedAlbum[] = [];

  for (const group of grouped) {
    if (group.length === 1) {
      const primary: UnifiedAlbum = {
        ...group[0],
        splitIds: [group[0].id],
      };
      albumSplitMap.set(primary.id, [primary.id]);
      result.push(primary);
    } else {
      // Pick primary album: prefer solo artist (no commas/feat) and higher songCount
      const sorted = [...group].sort((a, b) => {
        const aArt = cleanArtistName(a.artist);
        const bArt = cleanArtistName(b.artist);
        const aHasComma = aArt.includes(',') || aArt.includes('&');
        const bHasComma = bArt.includes(',') || bArt.includes('&');
        if (!aHasComma && bHasComma) return -1;
        if (aHasComma && !bHasComma) return 1;
        return (b.songCount || 0) - (a.songCount || 0);
      });

      const primary: UnifiedAlbum = { ...sorted[0] };
      const allIds = group.map((a) => a.id);
      primary.splitIds = allIds;
      primary.songCount = group.reduce((sum, a) => sum + (a.songCount || 0), 0);
      primary.duration = group.reduce((sum, a) => sum + (a.duration || 0), 0);

      // Preserve coverArt if primary didn't have one
      if (!primary.coverArt) {
        const withCover = group.find((a) => a.coverArt);
        if (withCover) primary.coverArt = withCover.coverArt;
      }

      for (const a of group) {
        albumSplitMap.set(a.id, allIds);
      }

      result.push(primary);
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
      const songList = Array.isArray(alb.song) ? alb.song : [alb.song];
      for (const track of songList) {
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
