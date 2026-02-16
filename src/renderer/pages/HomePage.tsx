import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlay, FiDownload, FiRefreshCw, FiChevronDown, FiCheck, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

import { useElectronAPI } from '../hooks/useElectronAPI';
import DownloadProgress from '../components/DownloadProgress';
import ServerStatus from '../components/ServerStatus';
import type {
  MinecraftProfile,
  LauncherSettings,
  MinecraftVersion,
  LoaderVersion,
  LoaderType,
  DownloadProgress as DownloadProgressType,
  LauncherStatus,
} from '../types';

interface HomePageProps {
  profile: MinecraftProfile | null;
  settings: LauncherSettings | null;
  onLogin: () => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ profile, settings, onLogin, onLogout }) => {
  const api = useElectronAPI();

  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loaders, setLoaders] = useState<LoaderVersion[]>([]);
  const [selectedLoader, setSelectedLoader] = useState<LoaderType>('vanilla');
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>('');
  const [installedVersions, setInstalledVersions] = useState<string[]>([]);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isLoaderDropdownOpen, setIsLoaderDropdownOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launcherStatus, setLauncherStatus] = useState<LauncherStatus>({ isRunning: false });

  // Load versions
  useEffect(() => {
    const loadVersions = async () => {
      try {
        const allVersions = await api.versions.getAll();
        setVersions(allVersions);
        if (allVersions.length > 0) {
          setSelectedVersion(allVersions.find((v) => v.type === 'release')?.id || allVersions[0].id);
        }

        const installed = await api.versions.getInstalled();
        setInstalledVersions(installed);
      } catch (error) {
        console.error('Failed to load versions:', error);
        toast.error('Nie udało się pobrać listy wersji');
      }
    };

    loadVersions();
  }, []);

  // Load loaders when version changes
  useEffect(() => {
    const loadLoaders = async () => {
      if (!selectedVersion) return;

      try {
        const availableLoaders = await api.loaders.getAvailable(selectedVersion);
        setLoaders(availableLoaders);
        
        // Reset to vanilla if current loader not available
        const hasCurrentLoader = availableLoaders.some(
          (l) => l.loader === selectedLoader && l.loader !== 'vanilla'
        );
        if (!hasCurrentLoader) {
          setSelectedLoader('vanilla');
          setSelectedLoaderVersion('');
        }
      } catch (error) {
        console.error('Failed to load loaders:', error);
      }
    };

    loadLoaders();
  }, [selectedVersion]);

  // Setup download progress listener
  useEffect(() => {
    const unsubscribe = api.on.downloadProgress((progress: DownloadProgressType) => {
      setDownloadProgress(progress);
      if (progress.percentage >= 100) {
        setTimeout(() => setDownloadProgress(null), 1000);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check game status
  useEffect(() => {
    const checkStatus = async () => {
      const status = await api.launcher.getStatus();
      setLauncherStatus(status);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleInstall = async () => {
    if (!selectedVersion) return;

    try {
      await api.versions.install(selectedVersion);
      const installed = await api.versions.getInstalled();
      setInstalledVersions(installed);
      toast.success(`Zainstalowano Minecraft ${selectedVersion}`);
    } catch (error) {
      console.error('Install failed:', error);
      toast.error('Instalacja nie powiodła się');
    }
  };

  const handleLaunch = async () => {
    if (!profile || !settings || !selectedVersion) return;

    // Check only critical server status (session server)
    try {
      const status = await api.status.getMojang();
      const sessionServer = status.find((s) => s.service.includes('session'));
      
      if (sessionServer?.status === 'red') {
        toast.error('Session Server Mojang jest niedostępny. Gra może nie działać poprawnie.');
        // Don't block - just warn
      }
    } catch (error) {
      console.warn('Could not check server status:', error);
    }

    setIsLaunching(true);

    try {
      // First check if base version is installed
      if (!isVersionInstalled) {
        toast.error(`Wersja ${selectedVersion} nie jest zainstalowana. Kliknij "Zainstaluj" najpierw.`);
        setIsLaunching(false);
        return;
      }

      // Warn if loader selected but may not be installed
      if (selectedLoader !== 'vanilla' && selectedLoaderVersion) {
        toast.loading('Próba uruchomienia z loaderem...', { duration: 2000 });
      }

      await api.launcher.launch({
        version: selectedVersion,
        loader: selectedLoader !== 'vanilla' ? selectedLoader : undefined,
        loaderVersion: selectedLoaderVersion || undefined,
        profile,
        settings,
      });
      toast.success('Uruchamianie Minecraft...');
    } catch (error: any) {
      console.error('Launch failed:', error);
      const errorMessage = error?.message || 'Nieznany błąd';
      if (errorMessage.includes('nie jest zainstalowana') || errorMessage.includes('not installed')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Java') || errorMessage.includes('java')) {
        toast.error('Nie znaleziono Java. Zainstaluj Java 17+ i ustaw ścieżkę w Ustawieniach.');
      } else if (errorMessage.includes('JAR')) {
        toast.error('Brak pliku JAR. Zainstaluj ponownie wersję.');
      } else {
        toast.error(`Błąd uruchamiania: ${errorMessage}`);
      }
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStopGame = async () => {
    try {
      await api.launcher.stop();
      toast.success('Zatrzymano grę');
    } catch (error) {
      console.error('Stop failed:', error);
    }
  };

  const isVersionInstalled = installedVersions.includes(selectedVersion);
  const loaderVersions = loaders.filter((l) => l.loader === selectedLoader);

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Witaj, <span className="text-gradient">{profile?.name || 'Graczu'}</span>
          </h1>
          <p className="text-launcher-textMuted">
            Wybierz wersję Minecraft i rozpocznij rozgrywkę
          </p>
        </div>

        {/* Server Status */}
        <ServerStatus />

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6"
        >
          {/* Login/Profile Section */}
          {!profile ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold mb-4">Zaloguj się przez Microsoft</h2>
              <p className="text-launcher-textMuted mb-6">
                Musisz się zalogować, aby grać w Minecraft
              </p>
              <button onClick={onLogin} className="btn-primary">
                Zaloguj się
              </button>
            </div>
          ) : (
            <>
              {/* Version Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Minecraft Version */}
                <div>
                  <label className="block text-sm font-medium mb-2">Wersja Minecraft</label>
                  <div className="relative">
                    <button
                      onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                      className="w-full input flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        {selectedVersion || 'Wybierz wersję'}
                        {isVersionInstalled && (
                          <FiCheck className="w-4 h-4 text-launcher-accent" />
                        )}
                      </span>
                      <FiChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isVersionDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isVersionDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-launcher-card border border-launcher-border rounded-lg shadow-xl max-h-60 overflow-auto z-10">
                        {versions.map((version) => (
                          <button
                            key={version.id}
                            onClick={() => {
                              setSelectedVersion(version.id);
                              setIsVersionDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-launcher-cardHover flex items-center justify-between ${
                              selectedVersion === version.id ? 'bg-launcher-accent/10' : ''
                            }`}
                          >
                            <span>{version.id}</span>
                            <span className="text-xs text-launcher-textDim">
                              {version.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Loader Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Loader</label>
                  <div className="relative">
                    <button
                      onClick={() => setIsLoaderDropdownOpen(!isLoaderDropdownOpen)}
                      className="w-full input flex items-center justify-between"
                    >
                      <span className="capitalize">{selectedLoader}</span>
                      <FiChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isLoaderDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isLoaderDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-launcher-card border border-launcher-border rounded-lg shadow-xl max-h-60 overflow-auto z-10">
                        {['vanilla', 'fabric', 'forge', 'neoforge'].map((loader) => {
                          const available = loaders.some((l) => l.loader === loader);
                          return (
                            <button
                              key={loader}
                              onClick={() => {
                                if (available) {
                                  setSelectedLoader(loader as LoaderType);
                                  const versions = loaders.filter((l) => l.loader === loader);
                                  setSelectedLoaderVersion(versions[0]?.version || '');
                                  setIsLoaderDropdownOpen(false);
                                }
                              }}
                              disabled={!available}
                              className={`w-full px-4 py-2 text-left flex items-center justify-between ${
                                available
                                  ? 'hover:bg-launcher-cardHover'
                                  : 'opacity-50 cursor-not-allowed'
                              } ${selectedLoader === loader ? 'bg-launcher-accent/10' : ''}`}
                            >
                              <span className="capitalize">{loader}</span>
                              {!available && (
                                <span className="text-xs text-launcher-textDim">Niedostępny</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loader Version (if not vanilla) */}
              {selectedLoader !== 'vanilla' && loaderVersions.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Wersja {selectedLoader}
                  </label>
                  <select
                    value={selectedLoaderVersion}
                    onChange={(e) => setSelectedLoaderVersion(e.target.value)}
                    className="input"
                  >
                    {loaderVersions.map((lv) => (
                      <option key={lv.version} value={lv.version}>
                        {lv.version} {lv.stable ? '(Stabilna)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Download Progress */}
              {downloadProgress && <DownloadProgress progress={downloadProgress} />}

              {/* Action Buttons */}
              <div className="flex gap-4">
                {!isVersionInstalled ? (
                  <button
                    onClick={handleInstall}
                    disabled={!selectedVersion || downloadProgress !== null}
                    className="btn-primary flex items-center gap-2"
                  >
                    <FiDownload className="w-5 h-5" />
                    Zainstaluj
                  </button>
                ) : launcherStatus.isRunning ? (
                  <button
                    onClick={handleStopGame}
                    className="btn-danger flex items-center gap-2"
                  >
                    <FiAlertCircle className="w-5 h-5" />
                    Zatrzymaj grę
                  </button>
                ) : !isVersionInstalled ? (
                  <button
                    onClick={handleInstall}
                    disabled={isLaunching || !profile}
                    className="btn-primary flex items-center gap-2"
                  >
                    <FiDownload className="w-5 h-5" />
                    Zainstaluj {selectedVersion}
                  </button>
                ) : (
                  <button
                    onClick={handleLaunch}
                    disabled={isLaunching || !profile}
                    className="btn-primary flex items-center gap-2 animate-pulse-glow"
                  >
                    {isLaunching ? (
                      <FiRefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <FiPlay className="w-5 h-5" />
                    )}
                    {isLaunching ? 'Uruchamianie...' : 'Graj'}
                  </button>
                )}

                <button onClick={onLogout} className="btn-secondary">
                  Wyloguj
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default HomePage;
