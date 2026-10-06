'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Home, Heart, Music, Mic2, Disc, ListMusic, Settings, ChevronLeft } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

const menuItems = [
  { id: 'home' as const, label: 'Главная', icon: Home },
  { id: 'favorites' as const, label: 'Избранное', icon: Heart },
  { id: 'tracks' as const, label: 'Треки', icon: Music },
  { id: 'artists' as const, label: 'Артисты', icon: Mic2 },
  { id: 'albums' as const, label: 'Альбомы', icon: Disc },
  { id: 'playlists' as const, label: 'Плейлисты', icon: ListMusic },
];

export function Sidebar() {
  const { activeTab, setActiveTab, toggleSettings, isSidebarOpen, toggleSidebar } = useUIStore();
  
  return (
    <>
      {/* Collapsed Sidebar Button */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={toggleSidebar}
            className="fixed left-4 top-6 z-40 p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5 text-white/90" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-0 top-0 h-screen w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 flex flex-col z-30"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
              <button 
                onClick={toggleSidebar}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white/70" />
              </button>
              <h1 className="text-xl font-light text-white/90 tracking-wide">core</h1>
            </div>
            
            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors group"
                  >
                    {/* Animated active pill */}
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-white/20 rounded-xl shadow-lg"
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30
                        }}
                      />
                    )}
                    
                    <Icon 
                      className={`w-5 h-5 relative z-10 transition-colors ${
                        isActive ? 'text-white' : 'text-white/50 group-hover:text-white/70'
                      }`} 
                    />
                    <span 
                      className={`relative z-10 transition-colors ${
                        isActive ? 'text-white font-semibold' : 'text-white/50 group-hover:text-white/70'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            
            {/* Settings at bottom */}
            <div className="px-4 pb-6 border-t border-white/10 pt-4">
              <button
                onClick={toggleSettings}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors group"
              >
                <Settings className="w-5 h-5 text-white/50 group-hover:text-white/70 transition-colors" />
                <span className="text-white/50 group-hover:text-white/70 transition-colors">
                  Настройки
                </span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
