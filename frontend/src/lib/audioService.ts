import { absoluteTime, withTimeOffset } from './streamSeek';

interface LoadOptions {
  offsetSeek?: boolean;
  startAt?: number;
}

class AudioService {
  private audio: HTMLAudioElement;
  private initialized = false;
  private sourceUrl = '';
  private baseTime = 0;
  private offsetSeek = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  getAudio(): HTMLAudioElement {
    return this.audio;
  }

  async play(): Promise<void> {
    try {
      if (!this.audio.src) return;
      await this.audio.play();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Safe user-abort during track switch or unmount
        return;
      }
      console.error('Autoplay failed:', error);
      // Sync state back to store
      const { usePlayerStore } = await import('@/store/playerStore');
      usePlayerStore.getState().pause();
      throw error;
    }
  }

  pause(): void {
    this.audio.pause();
  }

  seek(time: number): void {
    const target = Math.max(0, time);
    if (!this.offsetSeek || !this.sourceUrl) {
      this.audio.currentTime = target;
      return;
    }
    const wasPlaying = !this.audio.paused;
    this.baseTime = Math.floor(target);
    this.audio.src = withTimeOffset(this.sourceUrl, this.baseTime);
    this.audio.load();
    if (wasPlaying) {
      void this.play();
    }
  }

  getCurrentTime(): number {
    return absoluteTime(this.baseTime, this.audio.currentTime);
  }

  getDuration(): number {
    const duration = this.audio.duration;
    return Number.isFinite(duration) ? this.baseTime + duration : 0;
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  setSrc(src: string, options: LoadOptions = {}): void {
    this.sourceUrl = src;
    this.offsetSeek = options.offsetSeek ?? false;
    const startAt = Math.max(0, options.startAt ?? 0);
    this.baseTime = this.offsetSeek ? Math.floor(startAt) : 0;

    if (src) {
      this.audio.src = this.offsetSeek && this.baseTime > 0
        ? withTimeOffset(src, this.baseTime)
        : src;
      if (!this.offsetSeek && startAt > 0) {
        const applyStart = () => {
          this.audio.currentTime = startAt;
        };
        if (this.audio.readyState >= 1) applyStart();
        else this.audio.addEventListener('loadedmetadata', applyStart, { once: true });
      }
    } else {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  destroy(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.sourceUrl = '';
    this.baseTime = 0;
    this.offsetSeek = false;
  }
}

export const audioService = new AudioService();
