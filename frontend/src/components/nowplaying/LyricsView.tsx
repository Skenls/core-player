'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { Loader2, Music2 } from 'lucide-react';

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
  
  if (lyrics === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }
  
  if (!lyrics || (!lyrics.text && (!lyrics.lines || lyrics.lines.length === 0))) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/30">
        <Music2 className="w-12 h-12 stroke-[1.5]" />
        <p className="text-lg font-medium">Текст песни недоступен</p>
      </div>
    );
  }
  
  // If unsynced lines are provided
  if (!lyrics.synced || !lyrics.lines || lyrics.lines.length === 0) {
    const rawLines = lyrics.lines && lyrics.lines.length > 0 
      ? lyrics.lines 
      : lyrics.text.split('\n').filter(l => l.trim().length > 0).map(l => ({ time: 0, text: l }));

    return (
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-none pr-6 space-y-5 py-24 select-none"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
        }}
      >
        {rawLines.map((line, idx) => (
          <p 
            key={idx}
            className="text-2xl font-bold text-white/50 leading-relaxed hover:text-white/80 transition-colors"
          >
            {line.text}
          </p>
        ))}
      </div>
    );
  }
  
  // Synced lyrics view matching example-fullscreen-card.jpg
  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto scrollbar-none pr-8 select-none"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
      }}
    >
      <div className="space-y-6 py-48">
        {lyrics.lines.map((line, index) => {
          const isActive = index === activeLineIndex;
          
          return (
            <motion.div
              key={index}
              ref={isActive ? activeLineRef : null}
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0.35,
                scale: isActive ? 1.04 : 1,
                y: 0,
              }}
              transition={{
                duration: 0.35,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              onClick={() => seekToLine(index)}
              className={`cursor-pointer transition-colors duration-200 group origin-left ${
                isActive 
                  ? 'text-4xl font-extrabold text-white tracking-tight drop-shadow-md' 
                  : 'text-2xl font-bold text-white/40 hover:text-white/70'
              }`}
            >
              <span className="inline-block leading-snug">
                {line.text || '♪'}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
