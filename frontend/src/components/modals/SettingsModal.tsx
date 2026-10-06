'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Music, Upload } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useState } from 'react';

export function SettingsModal() {
  const { 
    isSettingsOpen, 
    toggleSettings,
    backgroundMode,
    customBackgroundUrl,
    audioCodec,
    setBackgroundMode,
    setCustomBackgroundUrl,
    setAudioCodec
  } = useUIStore();
  
  const [tempUrl, setTempUrl] = useState(customBackgroundUrl);

  const handleSaveBackground = () => {
    setCustomBackgroundUrl(tempUrl);
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSettings}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-2xl font-light text-white">Настройки</h2>
              <button
                onClick={toggleSettings}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
              
              {/* Background Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-white/70" />
                  <h3 className="text-lg font-medium text-white">Фон приложения</h3>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors group">
                    <input
                      type="radio"
                      name="background"
                      checked={backgroundMode === 'dynamic'}
                      onChange={() => setBackgroundMode('dynamic')}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">Динамический фон</div>
                      <div className="text-sm text-white/50">Автоматическая смена под обложку текущего трека</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors group">
                    <input
                      type="radio"
                      name="background"
                      checked={backgroundMode === 'custom'}
                      onChange={() => setBackgroundMode('custom')}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">Пользовательский фон</div>
                      <div className="text-sm text-white/50">Используйте свое изображение</div>
                    </div>
                  </label>
                  
                  {backgroundMode === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pl-7 space-y-3"
                    >
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempUrl}
                          onChange={(e) => setTempUrl(e.target.value)}
                          placeholder="/helpers/background.jpg"
                          className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                        />
                        <button
                          onClick={handleSaveBackground}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-white/40">
                        Укажите путь к изображению или URL
                      </p>
                    </motion.div>
                  )}
                </div>
              </section>
              
              {/* Audio Codec Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-white/70" />
                  <h3 className="text-lg font-medium text-white">Аудио кодек</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'mp3', label: 'MP3', desc: 'Универсальный, хорошее сжатие' },
                    { value: 'raw', label: 'RAW', desc: 'Без сжатия, оригинал' },
                    { value: 'opus', label: 'Opus', desc: 'Высокое качество, малый размер' },
                    { value: 'flac', label: 'FLAC', desc: 'Lossless, максимальное качество' },
                  ].map((codec) => (
                    <label
                      key={codec.value}
                      className={`flex flex-col gap-2 p-4 rounded-xl border cursor-pointer transition-all ${
                        audioCodec === codec.value
                          ? 'bg-white/10 border-white/30'
                          : 'border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="codec"
                        value={codec.value}
                        checked={audioCodec === codec.value}
                        onChange={(e) => setAudioCodec(e.target.value as any)}
                        className="sr-only"
                      />
                      <div className="text-white font-semibold">{codec.label}</div>
                      <div className="text-xs text-white/50">{codec.desc}</div>
                    </label>
                  ))}
                </div>
              </section>
              
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={toggleSettings}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
