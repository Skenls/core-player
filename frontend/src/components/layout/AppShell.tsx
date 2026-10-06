import { Sidebar } from './Sidebar';
import { PlayerBar } from '@/components/player/PlayerBar';
import { NowPlayingView } from '@/components/nowplaying/NowPlayingView';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { HomePage } from '@/views/HomePage';
import { FavoritesPage } from '@/views/FavoritesPage';
import { TracksPage } from '@/views/TracksPage';
import { ArtistsPage } from '@/views/ArtistsPage';
import { AlbumsPage } from '@/views/AlbumsPage';
import { PlaylistsPage } from '@/views/PlaylistsPage';
import { useUIStore } from '@/store/uiStore';

export function AppShell() {
  const { activeTab, isSidebarOpen } = useUIStore();
  
  return (
    <div className="h-screen overflow-hidden">
      <Sidebar />
      
      <main 
        className="h-full overflow-y-auto pb-32 transition-all duration-300"
        style={{ marginLeft: isSidebarOpen ? '256px' : '0' }}
      >
        <div className="container mx-auto px-8 py-8">
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'favorites' && <FavoritesPage />}
          {activeTab === 'tracks' && <TracksPage />}
          {activeTab === 'artists' && <ArtistsPage />}
          {activeTab === 'albums' && <AlbumsPage />}
          {activeTab === 'playlists' && <PlaylistsPage />}
        </div>
      </main>
      
      <PlayerBar />
      <NowPlayingView />
      <SettingsModal />
    </div>
  );
}
