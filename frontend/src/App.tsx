import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/components/layout/AppShell';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { api } from '@/api';
import { LoginPage } from '@/views/LoginPage';
import { DynamicBackground } from '@/components/background/DynamicBackground';

function AppContent() {
  const { isAuthenticated, isLoading, setUser, setLoading } = useSessionStore();
  
  useAudioEngine();
  useKeyboardShortcuts();
  
  useEffect(() => {
    api.auth.me().then((user) => {
      if (user) {
        setUser(user);
      } else {
        setLoading(false);
      }
    });
  }, [setUser, setLoading]);
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  
  return (
    <>
      <DynamicBackground />
      <AppShell />
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
