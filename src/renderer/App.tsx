import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import HomePage from './pages/HomePage';
import ModsPage from './pages/ModsPage';
import SettingsPage from './pages/SettingsPage';
import ConsolePanel from './components/ConsolePanel';
import NotificationPanel from './components/NotificationPanel';
import { useElectronAPI } from './hooks/useElectronAPI';
import { useNotifications } from './hooks/useNotifications';
import { I18nProvider } from './i18n';
import type { MinecraftProfile, LauncherSettings, Notification } from './types';

type Page = 'home' | 'mods' | 'settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [profile, setProfile] = useState<MinecraftProfile | null>(null);
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsole, setShowConsole] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const api = useElectronAPI();
  const { notifications, addNotification, markAsRead, clearAll } = useNotifications();

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load profile
        const savedProfile = await api.auth.getProfile();
        setProfile(savedProfile);

        // Load settings
        const savedSettings = await api.settings.get();
        setSettings(savedSettings);

        // Setup notification listeners
        const unsubscribe = api.on.notification((notification: Notification) => {
          addNotification(notification);
        });

        setIsLoading(false);

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Failed to initialize:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const handleLogin = async () => {
    try {
      const newProfile = await api.auth.login();
      setProfile(newProfile);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setProfile(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSettingsChange = async (newSettings: Partial<LauncherSettings>) => {
    try {
      await api.settings.set(newSettings);
      setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
      
      // Apply accent color as CSS variable
      if (newSettings.accentColor) {
        document.documentElement.style.setProperty('--color-accent', newSettings.accentColor);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Apply accent color on initial load and settings change
  useEffect(() => {
    if (settings?.accentColor) {
      document.documentElement.style.setProperty('--color-accent', settings.accentColor);
    }
  }, [settings?.accentColor]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-launcher-bg">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 border-4 border-launcher-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-launcher-textMuted">Ładowanie...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <I18nProvider initialLocale={settings?.language || 'pl'}>
      <div className="h-screen w-screen flex flex-col bg-launcher-bg overflow-hidden">
        <TitleBar
          profile={profile}
          onShowNotifications={() => setShowNotifications(!showNotifications)}
          notificationCount={notifications.filter((n) => !n.read).length}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onToggleConsole={() => setShowConsole(!showConsole)}
            showConsole={showConsole}
          />

          <main className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {currentPage === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <HomePage
                    profile={profile}
                    settings={settings}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                  />
                </motion.div>
              )}

              {currentPage === 'mods' && (
                <motion.div
                  key="mods"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <ModsPage settings={settings} />
                </motion.div>
              )}

              {currentPage === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <SettingsPage
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Console Panel */}
        <AnimatePresence>
          {showConsole && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 250 }}
              exit={{ height: 0 }}
              className="border-t border-launcher-border overflow-hidden"
            >
              <ConsolePanel onClose={() => setShowConsole(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications Panel */}
        <AnimatePresence>
          {showNotifications && (
            <NotificationPanel
              notifications={notifications}
              onClose={() => setShowNotifications(false)}
              onMarkAsRead={markAsRead}
              onClearAll={clearAll}
            />
          )}
        </AnimatePresence>
      </div>
    </I18nProvider>
  );
};

export default App;
