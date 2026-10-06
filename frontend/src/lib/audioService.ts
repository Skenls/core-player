class AudioService {
  private audio: HTMLAudioElement;
  private initialized = false;

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
    this.audio.currentTime = time;
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  setSrc(src: string): void {
    if (src) {
      this.audio.src = src;
    } else {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  destroy(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}

export const audioService = new AudioService();
