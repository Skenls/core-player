'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useArtists, useArtistDetails } from '@/hooks/useLibrary';
import { AlbumGrid } from '@/components/library/AlbumGrid';
import { Music2 } from 'lucide-react';

export function ArtistsPage() {
  const { data: artists, isLoading } = useArtists();
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  
  const { data: artistDetails, isLoading: isLoadingDetails } = useArtistDetails(selectedArtistId);
  
  // Group artists by first letter
  const groupedArtists = artists?.reduce((acc, artist) => {
    const firstLetter = artist.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(artist);
    return acc;
  }, {} as Record<string, typeof artists>);
  
  const letters = groupedArtists ? Object.keys(groupedArtists).sort() : [];
  const filteredArtists = selectedLetter && groupedArtists 
    ? groupedArtists[selectedLetter] 
    : artists;
  
  // If artist is selected, show details
  if (selectedArtistId && artistDetails) {
    return (
      <div className="space-y-8">
        {/* Back button */}
        <button
          onClick={() => setSelectedArtistId(null)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Назад к артистам</span>
        </button>
        
        {/* Artist header */}
        <div className="flex items-center gap-6">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
            {artistDetails.coverArt ? (
              <img
                src={`/api/stream/cover/${artistDetails.coverArt}?size=300`}
                alt={artistDetails.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 className="w-16 h-16 text-white/30" />
              </div>
            )}
          </div>
          
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">{artistDetails.name}</h1>
            <p className="text-white/50 text-lg">
              {artistDetails.albumCount || 0} альбомов
            </p>
          </div>
        </div>
        
        {/* Albums */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-6">Альбомы</h2>
          <AlbumGrid 
            items={artistDetails.album || []} 
            isLoading={isLoadingDetails}
            type="album"
          />
        </div>
      </div>
    );
  }
  
  // Main artists list
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/50 text-lg">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Артисты</h1>
        <p className="text-white/50">Ваши любимые исполнители</p>
      </div>
      
      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedLetter(null)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            selectedLetter === null
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
          }`}
        >
          Все
        </button>
        {letters.map((letter) => (
          <button
            key={letter}
            onClick={() => setSelectedLetter(letter)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedLetter === letter
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
      
      {/* Artists grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredArtists?.map((artist) => (
          <motion.div
            key={artist.id}
            whileHover={{ scale: 1.02 }}
            className="group cursor-pointer"
            onClick={() => setSelectedArtistId(artist.id)}
          >
            <div className="relative aspect-square rounded-full overflow-hidden bg-white/5 border border-white/10 mb-4">
              {artist.coverArt ? (
                <img
                  src={`/api/stream/cover/${artist.coverArt}?size=300`}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-12 h-12 text-white/30" />
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-sm">Открыть</div>
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-white font-medium truncate">{artist.name}</h3>
              <p className="text-white/50 text-sm">
                {artist.albumCount || 0} альбомов
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {filteredArtists && filteredArtists.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <p className="text-white/50 text-lg">Артисты не найдены</p>
        </div>
      )}
    </div>
  );
}
