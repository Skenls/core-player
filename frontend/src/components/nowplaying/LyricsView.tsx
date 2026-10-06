'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { Loader2, Music2, RotateCcw } from 'lucide-react';

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
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { activeLineIndex, seekToLine } = useLyricsSync(lyrics?.lines || null);

  const handleUserInteraction = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3500);
  };

  // Reset user scrolling state on unmount & attach passive listeners
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleUserInteraction, { passive: true });
      el.addEventListener('touchmove', handleUserInteraction, { passive: true });
    }

    return () => {
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
      if (el) {
        el.removeEventListener('wheel', handleUserInteraction);
        el.removeEventListener('touchmove', handleUserInteraction);
      }
    };
  }, []);

  // Synchronized auto-scroll
  useEffect(() => {
    if (isUserScrolling || !containerRef.current || !lyrics?.lines) return;

    const container = containerRef.current;

    if (activeLineIndex === -1) {
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      return;
    }

    if (activeLineIndex >= 0) {
      let targetScroll = 0;
      if (activeLineIndex > 0 && lineRefs.current[activeLineIndex - 1]) {
        // Position previous line at the very top (slot 1), so active line is slot 2
        const prevEl = lineRefs.current[activeLineIndex - 1]!;
        targetScroll = Math.max(0, prevEl.offsetTop - 20);
      } else if (lineRefs.current[0]) {
        // Line 0: top padding keeps it at slot 2
        const firstEl = lineRefs.current[0]!;
        targetScroll = Math.max(0, firstEl.offsetTop - 80);
      }

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }, [activeLineIndex, isUserScrolling, lyrics?.lines]);

  const handleLineClick = (index: number) => {
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    setIsUserScrolling(false);
    seekToLine(index);
  };

  const handleResumeSync = () => {
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    setIsUserScrolling(false);
  };

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
        className="h-full overflow-y-auto pr-6 space-y-4 py-8 select-none scrollbar-thin scrollbar-thumb-white/20 hover:scrollbar-thumb-white/40"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)'
        }}
      >
        <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-6">
          Текст песни (без временных меток)
        </div>
        {rawLines.map((line, idx) => (
          <p 
            key={idx}
            className="text-2xl font-bold text-white/60 leading-relaxed hover:text-white transition-colors"
          >
            {line.text}
          </p>
        ))}
      </div>
    );
  }
  
  // Synced lyrics view
  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onWheel={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        onPointerDown={handleUserInteraction}
        className="relative h-full overflow-y-auto scrollbar-none pr-8 select-none"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 85%, transparent 100%)'
        }}
      >
        <div className="space-y-6 pt-20 pb-72">
          {lyrics.lines.map((line, index) => {
            const isActive = index === activeLineIndex;
            const isPrevious = index === activeLineIndex - 1;
            const isUpcoming = index > activeLineIndex;

            let textStyle = 'text-2xl font-bold text-white/20 hover:text-white/50';
            if (isActive) {
              textStyle = 'text-4xl font-extrabold text-white tracking-tight drop-shadow-md';
            } else if (isPrevious) {
              textStyle = 'text-2xl font-bold text-white/35 hover:text-white/70';
            } else if (isUpcoming) {
              textStyle = 'text-2xl font-bold text-white/40 hover:text-white/70';
            }
            
            return (
              <motion.div
                key={index}
                ref={(el) => {
                  lineRefs.current[index] = el;
                }}
                initial={false}
                animate={{
                  opacity: isActive ? 1 : isPrevious ? 0.4 : isUpcoming ? 0.45 : 0.2,
                  scale: isActive ? 1.04 : 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.35,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                onClick={() => handleLineClick(index)}
                className={`cursor-pointer transition-colors duration-200 group origin-left transform-gpu will-change-transform ${textStyle}`}
              >
                <span className="inline-block leading-snug">
                  {line.text?.trim() ? line.text : '♪'}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Floating button when user scrolls manually */}
      <AnimatePresence>
        {isUserScrolling && activeLineIndex >= 0 && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            onClick={handleResumeSync}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold rounded-full shadow-2xl backdrop-blur-md transition-all flex items-center gap-2 z-20 cursor-pointer border border-white/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Синхронизировать</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
