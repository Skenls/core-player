'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function DynamicBackground() {
  const { currentTrack } = usePlayerStore();
  const { backgroundMode, customBackgroundUrl, backgroundBlur, backgroundDim } = useUIStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (backgroundMode === 'custom') {
      setImageUrl(customBackgroundUrl || '/background.jpg');
    } else if (currentTrack?.coverArt) {
      setImageUrl(`/api/stream/cover/${currentTrack.coverArt}?size=512`);
    } else {
      setImageUrl(null);
    }
  }, [currentTrack, backgroundMode, customBackgroundUrl]);
  
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-[#0a0c10]" />
      
      {/* Background image container */}
      <AnimatePresence mode="wait">
        {imageUrl && (
          <motion.div
            key={imageUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover scale-105"
              style={{
                filter: `blur(${backgroundBlur}px)`,
                transform: 'scale(1.08)',
                transition: 'filter 0.2s ease-out'
              }}
              onError={(e) => {
                // If custom background fails, fallback to default public background
                if (backgroundMode === 'custom' && imageUrl !== '/background.jpg') {
                  setImageUrl('/background.jpg');
                } else {
                  e.currentTarget.style.display = 'none';
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Darkening / Dim overlay */}
      <div 
        className="absolute inset-0 transition-colors duration-200"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${backgroundDim / 100})`
        }}
      />
      
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/60 pointer-events-none" />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
