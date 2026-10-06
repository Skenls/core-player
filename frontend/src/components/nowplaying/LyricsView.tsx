'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { Loader2 } from 'lucide-react';

interface LyricsData {
  text: string;
  synced: boolean;
  lines: Array<{ time: number; text: string }> | null;
}

interface LyricsViewProps {
  lyrics?: LyricsData | null;
}

export function LyricsView({ lyrics }: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  
  const { activeLineIndex, seekToLine } = useLyricsSync(lyrics?.lines || null);
  
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLineIndex]);
  
  if (!lyrics) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    );
  }
  
  if (!lyrics.synced || !lyrics.lines || lyrics.lines.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-4"
      >
        <div className="text-white/70 text-lg leading-relaxed whitespace-pre-wrap">
          {lyrics.text || 'Текст песни недоступен'}
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-4"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
      }}
    >
      <div className="space-y-4 py-32">
        {lyrics.lines.map((line, index) => {
          const isActive = index === activeLineIndex;
          
          return (
            <motion.div
              key={index}
              ref={isActive ? activeLineRef : null}
              initial={{ opacity: 0.4 }}
              animate={{
                opacity: isActive ? 1 : 0.4,
                scale: isActive ? 1.05 : 1,
                color: isActive ? '#ffffff' : '#ffffff99'
              }}
              transition={{
                duration: 0.3,
                ease: 'easeOut'
              }}
              onClick={() => seekToLine(index)}
              className="text-2xl leading-relaxed cursor-pointer hover:opacity-100 transition-opacity"
            >
              {line.text || '♪'}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
