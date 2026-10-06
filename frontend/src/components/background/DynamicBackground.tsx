'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function DynamicBackground() {
  const { currentTrack } = usePlayerStore();
  const { backgroundMode, customBackgroundUrl } = useUIStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (backgroundMode === 'custom') {
      setImageUrl(customBackgroundUrl);
    } else if (currentTrack?.coverArt) {
      setImageUrl(`/api/stream/cover/${currentTrack.coverArt}?size=512`);
    } else {
      setImageUrl(null);
    }
  }, [currentTrack, backgroundMode, customBackgroundUrl]);
  
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]" />
      
      {/* Dynamic album art background */}
      <AnimatePresence mode="wait">
        {imageUrl && (
          <motion.div
            key={imageUrl}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ 
              opacity: 1, 
              scale: 1.05,
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              duration: 1.2,
              ease: [0.43, 0.13, 0.23, 0.96]
            }}
            className="absolute inset-0"
          >
            <motion.div
              animate={{
                scale: [1.05, 1.08, 1.05],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-full h-full"
            >
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover blur-[120px] opacity-20"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/20 to-black/60" />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
