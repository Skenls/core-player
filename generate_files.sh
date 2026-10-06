#!/bin/bash

# Script to generate remaining frontend files for Core Player

echo "Generating remaining frontend component files..."

# Create remaining component files with placeholders
# We'll create the actual implementations in the next step

cat > frontend/src/components/library/TrackCard.tsx << 'EOF'
'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useState } from 'react';
import type { Track } from '@/types/subsonic';

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

export function TrackCard({ track, onPlay }: TrackCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const coverUrl = track.coverArt 
    ? `/api/stream/cover/${track.coverArt}?size=300`
    : '/placeholder-album.png';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-4 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
      onClick={onPlay}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-white/5">
        <motion.img
          src={coverUrl}
          alt={track.album}
          className="w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          onLoad={() => setImageLoaded(true)}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl"
          >
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </motion.button>
        </motion.div>
        
        <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity bg-gradient-to-t from-blue-500/50 to-transparent blur-2xl pointer-events-none" />
      </div>
      
      <div className="space-y-1">
        <h3 className="font-semibold text-white truncate">
          {track.title}
        </h3>
        <p className="text-sm text-white/50 truncate">
          {track.artist}
        </p>
      </div>
    </motion.div>
  );
}
EOF

echo "✓ TrackCard.tsx created"

# Continue with remaining files in next message due to size
echo "Ready to create more files..."
