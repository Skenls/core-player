import { useEffect } from 'react';
import { useSynapseTelemetry } from '@/hooks/useSynapseTelemetry';
import { useSynapseAutoContinue } from '@/hooks/useSynapseAutoContinue';
import { useSynapseStore } from '@/store/synapseStore';
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
  useSynapseTelemetry();
  useSynapseAutoContinue();
  const notice = useSynapseStore(state => state.notice);
  const setNotice = useSynapseStore(state => state.setNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
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
      
      {notice && (
        <div role="status" className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-white/15 bg-zinc-900/95 px-5 py-3 text-sm text-white shadow-xl">
          {notice}
        </div>
      )}
      <PlayerBar />
      <NowPlayingView />
      <SettingsModal />
    </div>
  );
}
