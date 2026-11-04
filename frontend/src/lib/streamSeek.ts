const SOURCE_CODECS: Record<string, string> = {
  mp3: 'mp3',
  flac: 'flac',
  ogg: 'opus',
  oga: 'opus',
  opus: 'opus',
  m4a: 'aac',
  mp4: 'aac',
  aac: 'aac',
} as const;

export function shouldUseOffsetSeek(
  format: string | null | undefined,
  sourceSuffix: string | null | undefined,
): boolean {
  if (!format || format === 'raw') return false;
  const suffix = sourceSuffix?.toLowerCase();
  return !suffix || SOURCE_CODECS[suffix] !== format;
}

export function absoluteTime(base: number, current: number): number {
  return base + (Number.isFinite(current) ? current : 0);
}

export function withTimeOffset(src: string, seconds: number): string {
  const url = new URL(src, 'http://local.invalid');
  const offset = Math.max(0, Math.floor(seconds));
  if (offset > 0) {
    url.searchParams.set('timeOffset', String(offset));
  } else {
    url.searchParams.delete('timeOffset');
  }
  return url.pathname + url.search;
}
