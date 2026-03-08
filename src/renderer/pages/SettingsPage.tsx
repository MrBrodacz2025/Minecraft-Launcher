import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiFolder,
  FiSave,
  FiRefreshCw,
  FiMonitor,
  FiCpu,
  FiHardDrive,
  FiGlobe,
  FiZap,
  FiInfo,
  FiDroplet,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

import { useElectronAPI } from '../hooks/useElectronAPI';
import { useI18n } from '../i18n';
import type { LauncherSettings } from '../types';

interface SettingsPageProps {
  settings: LauncherSettings | null;
  onSettingsChange: (settings: LauncherSettings) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsChange }) => {
  const api = useElectronAPI();
  const { t, availableLocales, setLocale } = useI18n();

  const [localSettings, setLocalSettings] = useState<LauncherSettings | null>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    totalMemory: 16,
    recommendedMemory: 4,
  });

  // Preset accent colors
  const presetColors = [
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F97316', // Orange
    '#EAB308', // Yellow
    '#22C55E', // Green
    '#14B8A6', // Teal
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
  ];

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    // Get system memory info
    const getSystemInfo = async () => {
      // Simulate getting system info - in real app, this would come from main process
      const totalMem = Math.floor(16); // GB
      setSystemInfo({
        totalMemory: totalMem,
        recommendedMemory: Math.min(Math.floor(totalMem / 2), 8),
      });
    };
    getSystemInfo();
  }, []);

  const handleChange = <K extends keyof LauncherSettings>(
    key: K,
    value: LauncherSettings[K]
  ) => {
    if (!localSettings) return;
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!localSettings) return;
    try {
      await api.settings.set(localSettings);
      onSettingsChange(localSettings);
      setIsDirty(false);
      
      // Update locale if language changed
      if (localSettings.language !== settings?.language) {
        setLocale(localSettings.language);
      }
      
      toast.success(t('settings.saved'));
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('settings.saveFailed'));
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await api.utils.selectDirectory();
      if (result) {
        handleChange('gameDirectory', result);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleSelectJava = async () => {
    try {
      const result = await api.utils.selectFile({
        filters: [
          { name: 'Java', extensions: ['exe'] },
          { name: 'Wszystkie pliki', extensions: ['*'] },
        ],
      });
      if (result) {
        handleChange('javaPath', result);
      }
    } catch (error) {
      console.error('Failed to select Java:', error);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setIsDirty(false);
  };

  if (!localSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-launcher-textMuted">Ładowanie ustawień...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-launcher-border flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ustawienia</h1>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="btn-secondary disabled:opacity-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Resetuj
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="btn-primary disabled:opacity-50"
          >
            <FiSave className="w-4 h-4" />
            Zapisz
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Game Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-launcher-accent/20 rounded-lg flex items-center justify-center">
              <FiMonitor className="w-5 h-5 text-launcher-accent" />
            </div>
            <div>
              <h2 className="font-semibold">Ustawienia gry</h2>
              <p className="text-sm text-launcher-textMuted">Rozdzielczość i tryb okna</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Rozdzielczość</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="number"
                    value={localSettings.resolution.width}
                    onChange={(e) =>
                      handleChange('resolution', {
                        ...localSettings.resolution,
                        width: parseInt(e.target.value) || 854,
                      })
                    }
                    className="input"
                    placeholder="Szerokość"
                  />
                </div>
                <span className="flex items-center text-launcher-textDim">×</span>
                <div className="flex-1">
                  <input
                    type="number"
                    value={localSettings.resolution.height}
                    onChange={(e) =>
                      handleChange('resolution', {
                        ...localSettings.resolution,
                        height: parseInt(e.target.value) || 480,
                      })
                    }
                    className="input"
                    placeholder="Wysokość"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tryb okna</label>
              <select
                value={localSettings.fullscreen ? 'fullscreen' : 'windowed'}
                onChange={(e) => handleChange('fullscreen', e.target.value === 'fullscreen')}
                className="input"
              >
                <option value="windowed">Okno</option>
                <option value="fullscreen">Pełny ekran</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* Memory Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <FiCpu className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="font-semibold">Pamięć RAM</h2>
              <p className="text-sm text-launcher-textMuted">
                Dostępne: {systemInfo.totalMemory} GB, zalecane: {systemInfo.recommendedMemory} GB
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Minimum RAM (MB)</label>
                <span className="text-launcher-accent font-mono">
                  {localSettings.minMemory} MB
                </span>
              </div>
              <input
                type="range"
                min={512}
                max={Math.min(localSettings.maxMemory, 8192)}
                step={256}
                value={localSettings.minMemory}
                onChange={(e) => handleChange('minMemory', parseInt(e.target.value))}
                className="w-full accent-launcher-accent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Maximum RAM (MB)</label>
                <span className="text-launcher-accent font-mono">
                  {localSettings.maxMemory} MB
                </span>
              </div>
              <input
                type="range"
                min={Math.max(localSettings.minMemory, 1024)}
                max={systemInfo.totalMemory * 1024}
                step={512}
                value={localSettings.maxMemory}
                onChange={(e) => handleChange('maxMemory', parseInt(e.target.value))}
                className="w-full accent-launcher-accent"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-launcher-cardHover rounded-lg text-sm">
              <FiInfo className="w-4 h-4 text-launcher-accent mt-0.5 flex-shrink-0" />
              <p className="text-launcher-textMuted">
                Zalecane jest przydzielenie 25-50% dostępnej pamięci RAM.
                Zbyt dużo pamięci może spowodować problemy z wydajnością.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Paths */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <FiHardDrive className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold">Lokalizacje</h2>
              <p className="text-sm text-launcher-textMuted">Ścieżki do plików gry</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Folder gry</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localSettings.gameDirectory}
                  onChange={(e) => handleChange('gameDirectory', e.target.value)}
                  className="input flex-1"
                  readOnly
                />
                <button onClick={handleSelectDirectory} className="btn-secondary">
                  <FiFolder className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Ścieżka do Java (opcjonalnie)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localSettings.javaPath || ''}
                  onChange={(e) => handleChange('javaPath', e.target.value || undefined)}
                  placeholder="Automatycznie wykryj"
                  className="input flex-1"
                />
                <button onClick={handleSelectJava} className="btn-secondary">
                  <FiFolder className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* JVM Arguments */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <FiZap className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold">Argumenty JVM</h2>
              <p className="text-sm text-launcher-textMuted">
                Zaawansowane ustawienia Java
              </p>
            </div>
          </div>

          <textarea
            value={localSettings.jvmArguments}
            onChange={(e) => handleChange('jvmArguments', e.target.value)}
            className="input min-h-[100px] font-mono text-sm resize-y"
            placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..."
          />

          <div className="flex items-start gap-2 p-3 bg-launcher-cardHover rounded-lg text-sm mt-4">
            <FiInfo className="w-4 h-4 text-launcher-accent mt-0.5 flex-shrink-0" />
            <p className="text-launcher-textMuted">
              Domyślne argumenty są już zoptymalizowane. Modyfikuj tylko jeśli wiesz co robisz.
            </p>
          </div>
        </motion.section>

        {/* Launcher Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <FiGlobe className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold">Ustawienia Launchera</h2>
              <p className="text-sm text-launcher-textMuted">Zachowanie aplikacji</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-launcher-cardHover rounded-lg cursor-pointer hover:bg-launcher-border transition-colors">
              <div>
                <span className="font-medium">Zamknij launcher po uruchomieniu gry</span>
                <p className="text-sm text-launcher-textMuted mt-1">
                  Automatycznie zamyka launcher gdy gra się uruchomi
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.closeOnLaunch}
                onChange={(e) => handleChange('closeOnLaunch', e.target.checked)}
                className="w-5 h-5 accent-launcher-accent rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-launcher-cardHover rounded-lg cursor-pointer hover:bg-launcher-border transition-colors">
              <div>
                <span className="font-medium">Automatyczne aktualizacje</span>
                <p className="text-sm text-launcher-textMuted mt-1">
                  Sprawdzaj i instaluj aktualizacje launchera automatycznie
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoUpdate}
                onChange={(e) => handleChange('autoUpdate', e.target.checked)}
                className="w-5 h-5 accent-launcher-accent rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-launcher-cardHover rounded-lg cursor-pointer hover:bg-launcher-border transition-colors">
              <div>
                <span className="font-medium">Sprawdzaj snapshoty</span>
                <p className="text-sm text-launcher-textMuted mt-1">
                  Pokazuj wersje snapshotów w liście wersji
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.showSnapshots}
                onChange={(e) => handleChange('showSnapshots', e.target.checked)}
                className="w-5 h-5 accent-launcher-accent rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-launcher-cardHover rounded-lg cursor-pointer hover:bg-launcher-border transition-colors">
              <div>
                <span className="font-medium">Sprawdzaj aktualizacje loaderów</span>
                <p className="text-sm text-launcher-textMuted mt-1">
                  Automatycznie powiadamiaj o nowych wersjach Fabric/Forge/NeoForge
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.checkLoaderUpdates}
                onChange={(e) => handleChange('checkLoaderUpdates', e.target.checked)}
                className="w-5 h-5 accent-launcher-accent rounded"
              />
            </label>
          </div>
        </motion.section>

        {/* Appearance Settings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
              <FiDroplet className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <h2 className="font-semibold">{t('settings.appearance.title')}</h2>
              <p className="text-sm text-launcher-textMuted">{t('settings.appearance.description')}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.appearance.language')}</label>
              <select
                value={localSettings.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="input w-full max-w-xs"
              >
                {availableLocales.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.name} {locale.isCustom && '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Accent Color Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('settings.appearance.accentColor')}</label>
              <div className="flex flex-wrap gap-3">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleChange('accentColor', color)}
                    className={`w-10 h-10 rounded-lg transition-all duration-200 hover:scale-110 ${
                      localSettings.accentColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-launcher-card'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom color input */}
                <div className="relative">
                  <input
                    type="color"
                    value={localSettings.accentColor || '#3B82F6'}
                    onChange={(e) => handleChange('accentColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-2 border-launcher-border hover:border-launcher-textMuted transition-colors"
                    title={t('settings.appearance.selectColor')}
                  />
                </div>
              </div>
              <p className="text-sm text-launcher-textMuted mt-2">
                {t('settings.appearance.accentColor')}: <span className="font-mono">{localSettings.accentColor}</span>
              </p>
            </div>
          </div>
        </motion.section>

        {/* About */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-launcher-textDim/20 rounded-lg flex items-center justify-center">
              <FiInfo className="w-5 h-5 text-launcher-textDim" />
            </div>
            <div>
              <h2 className="font-semibold">O aplikacji</h2>
              <p className="text-sm text-launcher-textMuted">Informacje o launcherze</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-launcher-cardHover rounded-lg">
              <span className="text-launcher-textMuted">Wersja</span>
              <p className="font-mono mt-1">1.0.0</p>
            </div>
            <div className="p-3 bg-launcher-cardHover rounded-lg">
              <span className="text-launcher-textMuted">Electron</span>
              <p className="font-mono mt-1">29.0.1</p>
            </div>
            <div className="p-3 bg-launcher-cardHover rounded-lg">
              <span className="text-launcher-textMuted">Node.js</span>
              <p className="font-mono mt-1">20.x</p>
            </div>
            <div className="p-3 bg-launcher-cardHover rounded-lg">
              <span className="text-launcher-textMuted">Chromium</span>
              <p className="font-mono mt-1">132.x</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-launcher-border text-center text-sm text-launcher-textMuted">
            © 2024-2026 EnderGate. Nieoficjalny launcher.
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default SettingsPage;
