import { AlbumGrid } from '@/components/library/AlbumGrid';
import { useAlbums, useRandomTracks } from '@/hooks/useLibrary';

export function HomePage() {
  const { data: albums, isLoading: albumsLoading } = useAlbums('newest', 24);
  const { data: tracks, isLoading: tracksLoading } = useRandomTracks(50);
  
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Главная</h1>
        <p className="text-white/50">Ваша музыкальная библиотека</p>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold text-white mb-6">Недавно добавленные</h2>
        <AlbumGrid 
          items={albums || []} 
          isLoading={albumsLoading}
          type="album"
        />
      </section>
      
      <section>
        <h2 className="text-2xl font-semibold text-white mb-6">Случайные треки</h2>
        <AlbumGrid 
          items={tracks || []} 
          isLoading={tracksLoading}
          type="track"
        />
      </section>
    </div>
  );
}
