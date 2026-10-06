import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';

interface LyricsLine {
  time: number;
  text: string;
}

export function useLyricsSync(lines: LyricsLine[] | null) {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  
  useEffect(() => {
    if (!lines || lines.length === 0) {
      setActiveLineIndex(-1);
      return;
    }
    
    // Find the current active line (last line where time <= currentTime)
    let activeIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].time <= currentTime) {
        activeIndex = i;
        break;
      }
    }
    
    setActiveLineIndex(activeIndex);
  }, [currentTime, lines]);
  
  const seekToLine = (index: number) => {
    if (!lines || index < 0 || index >= lines.length) return;
    usePlayerStore.getState().seek(lines[index].time);
  };
  
  return { activeLineIndex, seekToLine };
}
