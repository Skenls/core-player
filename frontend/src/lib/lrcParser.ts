/**
 * Parse LRC format lyrics into structured format
 * Format: [mm:ss.xx]Line text
 */

interface LyricsLine {
  time: number;
  text: string;
}

export function parseLRC(lrcText: string): LyricsLine[] {
  const lines: LyricsLine[] = [];
  const lrcLines = lrcText.split('\n');

  for (const line of lrcLines) {
    // Match [mm:ss.xx] or [mm:ss]
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const text = match[3].trim();
      
      const timeInSeconds = minutes * 60 + seconds;
      
      lines.push({
        time: timeInSeconds,
        text: text || '♪',
      });
    }
  }

  // Sort by time
  return lines.sort((a, b) => a.time - b.time);
}
