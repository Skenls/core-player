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
      await this.audio.play();
    } catch (error) {
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
    this.audio.src = src;
  }

  destroy(): void {
    this.audio.pause();
    this.audio.src = '';
  }
}

export const audioService = new AudioService();
