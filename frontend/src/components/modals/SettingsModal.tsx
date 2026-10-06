'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Music, Upload, Users, Trash2, Plus, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useUIStore, type AudioCodec } from '@/store/uiStore';
import { useSessionStore } from '@/store/sessionStore';
import { usePlayerStore } from '@/store/playerStore';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';

type SettingsTab = 'appearance' | 'audio' | 'users';

export function SettingsModal() {
  const { 
    isSettingsOpen, 
    toggleSettings,
    backgroundMode,
    customBackgroundUrl,
    backgroundBlur,
    backgroundDim,
    audioCodec,
    setBackgroundMode,
    setCustomBackgroundUrl,
    setBackgroundBlur,
    setBackgroundDim,
    setAudioCodec
  } = useUIStore();
  
  const { user } = useSessionStore();
  const { reloadCodec } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [tempUrl, setTempUrl] = useState(customBackgroundUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // User creation form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [userError, setUserError] = useState('');
  
  const queryClient = useQueryClient();
  
  // Admin queries
  const { data: usersList, isLoading: isUsersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.admin.getUsers(),
    enabled: isSettingsOpen && user?.role === 'admin' && activeTab === 'users',
  });
  
  const createUserMutation = useMutation({
    mutationFn: () => api.admin.createUser({
      username: newUsername.trim(),
      password: newPassword,
      role: newRole,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setUserError('');
    },
    onError: (err: any) => {
      setUserError(err.response?.data?.detail || 'Ошибка создания пользователя');
    },
  });
  
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.admin.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Ошибка удаления пользователя');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomBackgroundUrl(dataUrl);
        setTempUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBackgroundUrl = () => {
    if (tempUrl.trim()) {
      setCustomBackgroundUrl(tempUrl.trim());
    }
  };

  const handleCodecChange = (codec: AudioCodec) => {
    setAudioCodec(codec);
    setTimeout(() => {
      reloadCodec();
    }, 50);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    createUserMutation.mutate();
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSettings}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />
          
          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-2xl bg-[#14161b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-xl font-medium text-white">Настройки</h2>
              <button
                onClick={toggleSettings}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex px-6 pt-3 border-b border-white/5 gap-2 bg-black/20">
              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'appearance'
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Image className="w-4 h-4" />
                Внешний вид
              </button>

              <button
                onClick={() => setActiveTab('audio')}
                className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'audio'
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Music className="w-4 h-4" />
                Аудио кодек
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'users'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Пользователи
                </button>
              )}
            </div>
            
            {/* Content Area */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* TAB: APPEARANCE */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  {/* Mode options */}
                  <div className="space-y-3">
                    <label className="text-xs uppercase font-semibold text-white/50 tracking-wider">
                      Режим фона
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBackgroundMode('dynamic')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          backgroundMode === 'dynamic'
                            ? 'bg-blue-600/20 border-blue-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white mb-1">Динамический</div>
                        <div className="text-xs text-white/50">Автоматическая смена под обложку трека</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBackgroundMode('custom')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          backgroundMode === 'custom'
                            ? 'bg-blue-600/20 border-blue-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-white mb-1">Пользовательский</div>
                        <div className="text-xs text-white/50">Ваше изображение или обои</div>
                      </button>
                    </div>
                  </div>

                  {/* Custom Background Upload / Input */}
                  {backgroundMode === 'custom' && (
                    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                      <label className="text-xs uppercase font-semibold text-white/50 tracking-wider">
                        Изображение фона
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempUrl}
                          onChange={(e) => setTempUrl(e.target.value)}
                          placeholder="Введите URL или путь..."
                          className="flex-1 px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30"
                        />
                        <button
                          type="button"
                          onClick={handleSaveBackgroundUrl}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-colors"
                        >
                          Применить
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                          title="Загрузить файл с компьютера"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Файл</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                      <p className="text-xs text-white/40">
                        Поддерживаются форматы JPG, PNG, WebP или прямые веб-ссылки
                      </p>
                    </div>
                  )}

                  {/* Blur Slider */}
                  <div className="space-y-2 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Размытие фона (Blur)</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-white/80">
                        {backgroundBlur}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="2"
                      value={backgroundBlur}
                      onChange={(e) => setBackgroundBlur(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-white/40">
                      <span>Четкий (0px)</span>
                      <span>Мягкий (24px)</span>
                      <span>Глубокий (60px)</span>
                    </div>
                  </div>

                  {/* Dimming Slider */}
                  <div className="space-y-2 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Затемнение фона</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-white/80">
                        {backgroundDim}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={backgroundDim}
                      onChange={(e) => setBackgroundDim(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-white/40">
                      <span>Светлее (10%)</span>
                      <span>Баланс (50%)</span>
                      <span>Темнее (90%)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: AUDIO */}
              {activeTab === 'audio' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-white">Формат транскодирования аудио</h3>
                    <p className="text-xs text-white/50">
                      Сервер Navidrome налету упаковывает аудиопоток в выбранный кодек
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'mp3', label: 'MP3', desc: 'Универсальный, хорошее сжатие (320kbps)' },
                      { value: 'raw', label: 'RAW (Оригинал)', desc: 'Без транскодирования, исходный файл' },
                      { value: 'opus', label: 'Opus', desc: 'Современный, высокое качество при малом размере' },
                      { value: 'flac', label: 'FLAC', desc: 'Lossless без потерь качества' },
                    ].map((codec) => (
                      <button
                        key={codec.value}
                        type="button"
                        onClick={() => handleCodecChange(codec.value as AudioCodec)}
                        className={`flex flex-col gap-1 p-4 rounded-xl border text-left transition-all ${
                          audioCodec === codec.value
                            ? 'bg-blue-600/20 border-blue-500/50 shadow-inner'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-white">{codec.label}</span>
                          {audioCodec === codec.value && (
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                          )}
                        </div>
                        <span className="text-xs text-white/50">{codec.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: USERS (Admin Only) */}
              {activeTab === 'users' && user?.role === 'admin' && (
                <div className="space-y-6">
                  {/* Create user form */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-400" />
                      Создать пользователя
                    </h3>
                    
                    <form onSubmit={handleCreateUser} className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">Логин</label>
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            placeholder="username"
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">Пароль</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">Роль</label>
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                          >
                            <option value="user" className="bg-zinc-900">Пользователь</option>
                            <option value="admin" className="bg-zinc-900">Администратор</option>
                          </select>
                        </div>
                      </div>

                      {userError && (
                        <p className="text-xs text-red-400">{userError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={createUserMutation.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {createUserMutation.isPending ? 'Создание...' : 'Создать'}
                      </button>
                    </form>
                  </div>

                  {/* Users table */}
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase font-semibold text-white/50 tracking-wider">
                      Зарегистрированные пользователи
                    </h3>
                    
                    {isUsersLoading ? (
                      <p className="text-sm text-white/40 py-4 text-center">Загрузка...</p>
                    ) : (
                      <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                        {usersList?.map((u) => {
                          const isSelf = u.id === user.id;
                          return (
                            <div key={u.id} className="flex items-center justify-between p-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/5 text-white/70">
                                  {u.role === 'admin' ? (
                                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                                  ) : (
                                    <UserIcon className="w-4 h-4 text-white/50" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white flex items-center gap-2">
                                    {u.username}
                                    {isSelf && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                        Вы
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-white/40">
                                    {u.role === 'admin' ? 'Администратор' : 'Обычный пользователь'}
                                  </div>
                                </div>
                              </div>

                              <div>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Удалить пользователя ${u.username}?`)) {
                                        deleteUserMutation.mutate(u.id);
                                      }
                                    }}
                                    disabled={deleteUserMutation.isPending}
                                    className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Удалить пользователя"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
