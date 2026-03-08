import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiDownload,
  FiTrash2,
  FiFilter,
  FiX,
  FiExternalLink,
  FiRefreshCw,
  FiToggleLeft,
  FiToggleRight,
  FiAlertCircle,
  FiArrowUp,
  FiPlay,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

import { useElectronAPI } from '../hooks/useElectronAPI';
import { useI18n } from '../i18n';
import type {
  Modpack,
  ModpackFile,
  InstalledModpack,
  ModpackSearchFilters,
  LauncherSettings,
  MinecraftProfile,
  LoaderType,
  DownloadProgress as DownloadProgressType,
} from '../types';

interface ModpacksPageProps {
  settings: LauncherSettings | null;
  profile: MinecraftProfile | null;
}

const ModpacksPage: React.FC<ModpacksPageProps> = ({ settings, profile }) => {
  const api = useElectronAPI();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'search' | 'installed'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Modpack[]>([]);
  const [installedModpacks, setInstalledModpacks] = useState<InstalledModpack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModpack, setSelectedModpack] = useState<Modpack | null>(null);
  const [selectedModpackFiles, setSelectedModpackFiles] = useState<ModpackFile[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [launchingModpackId, setLaunchingModpackId] = useState<string | null>(null);

  const [filters, setFilters] = useState<ModpackSearchFilters>({
    source: 'curseforge',
    sortBy: 'downloads',
    gameVersion: '',
    loader: undefined,
  });

  useEffect(() => {
    loadInstalledModpacks();
  }, []);

  useEffect(() => {
    const unsubscribe = api.on.downloadProgress((progress: DownloadProgressType) => {
      if (progress.type === 'mod') {
        setDownloadProgress(progress);
        if (progress.percentage >= 100) {
          setTimeout(() => {
            setDownloadProgress(null);
            loadInstalledModpacks();
          }, 500);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loadInstalledModpacks = async () => {
    try {
      const modpacks = await api.modpacks.getInstalled();
      setInstalledModpacks(modpacks);
    } catch (error) {
      console.error('Failed to load installed modpacks:', error);
    }
  };

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback(async (query: string, currentFilters: ModpackSearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await api.modpacks.search(query, currentFilters);
      setSearchResults(results);
    } catch (error: any) {
      console.error('Search failed:', error);
      toast.error(t('modpacks.searchFailed'));
    } finally {
      setIsSearching(false);
    }
  }, [api, t]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        debouncedSearch(searchQuery, filters);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, filters, debouncedSearch]);

  const handleSearch = async () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    await debouncedSearch(searchQuery, filters);
  };

  const handleModpackClick = async (modpack: Modpack) => {
    setSelectedModpack(modpack);
    setSelectedModpackFiles(modpack.latestFiles || []);

    // Load all files
    try {
      const files = await api.modpacks.getFiles(modpack.id, modpack.source);
      if (files.length > 0) {
        setSelectedModpackFiles(files);
      }
    } catch (error) {
      console.error('Failed to load modpack files:', error);
    }
  };

  const handleInstallModpack = async (modpack: Modpack, file: ModpackFile) => {
    // Close modal and switch to installed tab immediately
    setSelectedModpack(null);
    setActiveTab('installed');
    toast(t('modpacks.installing', { name: modpack.name }), { icon: '📦' });

    try {
      await api.modpacks.install(modpack, file);
      toast.success(t('modpacks.installSuccess', { name: modpack.name }));
      loadInstalledModpacks();
    } catch (error) {
      console.error('Install failed:', error);
      toast.error(t('modpacks.installFailed', { name: modpack.name }));
    }
  };

  const handleUninstallModpack = async (modpackId: string) => {
    try {
      await api.modpacks.uninstall(modpackId);
      toast.success(t('modpacks.uninstallSuccess'));
      loadInstalledModpacks();
    } catch (error) {
      console.error('Uninstall failed:', error);
      toast.error(t('modpacks.uninstallFailed'));
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const updatable = await api.modpacks.checkUpdates();
      if (updatable.length > 0) {
        toast.success(t('modpacks.updatesFound', { count: updatable.length.toString() }));
        loadInstalledModpacks();
      } else {
        toast(t('modpacks.noUpdates'));
      }
    } catch (error) {
      console.error('Check updates failed:', error);
      toast.error(t('modpacks.checkUpdatesFailed'));
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpdateModpack = async (modpackId: string) => {
    try {
      await api.modpacks.update(modpackId);
      toast.success(t('modpacks.updateSuccess'));
      loadInstalledModpacks();
    } catch (error) {
      console.error('Update failed:', error);
      toast.error(t('modpacks.updateFailed'));
    }
  };

  const handleToggleAutoUpdate = async (modpackId: string, currentValue: boolean) => {
    try {
      await api.modpacks.setAutoUpdate(modpackId, !currentValue);
      loadInstalledModpacks();
    } catch (error) {
      console.error('Toggle auto-update failed:', error);
    }
  };

  const handleLaunchModpack = async (modpack: InstalledModpack) => {
    if (!profile || !settings) {
      toast.error(t('modpacks.loginRequired'));
      return;
    }

    setLaunchingModpackId(modpack.id);
    try {
      // Check if the base Minecraft version is installed, auto-install if missing
      const installedVersions: string[] = await api.versions.getInstalled();
      if (!installedVersions.includes(modpack.gameVersion)) {
        toast.loading(t('modpacks.autoInstalling', { version: modpack.gameVersion }), { id: 'auto-install' });
        try {
          await api.versions.install(modpack.gameVersion);
          toast.success(t('modpacks.autoInstallSuccess', { version: modpack.gameVersion }), { id: 'auto-install' });
        } catch (installError: any) {
          console.error('Auto-install failed:', installError);
          toast.error(t('modpacks.autoInstallFailed', { version: modpack.gameVersion }), { id: 'auto-install' });
          return;
        }
      }

      await api.launcher.launch({
        version: modpack.gameVersion,
        loader: modpack.loader !== 'vanilla' ? modpack.loader : undefined,
        loaderVersion: undefined,
        profile,
        settings,
        modpackPath: modpack.installPath,
        modpackName: modpack.name,
      });
      toast.success(t('modpacks.launching', { name: modpack.name }));
    } catch (error: any) {
      console.error('Modpack launch failed:', error);
      const msg = error?.message || '';
      if (msg.includes('nie jest zainstalowana') || msg.includes('not installed')) {
        toast.error(t('modpacks.versionNotInstalled', { version: modpack.gameVersion }));
      } else {
        toast.error(t('modpacks.launchFailed', { name: modpack.name }));
      }
    } finally {
      setLaunchingModpackId(null);
    }
  };

  const handleOpenExternal = (url: string) => {
    api.utils.openExternal(url);
  };

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-launcher-border">
        <h1 className="text-2xl font-bold mb-4">{t('modpacks.title')}</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-launcher-accent text-white'
                : 'text-launcher-textMuted hover:bg-launcher-card'
            }`}
          >
            {t('modpacks.browse')}
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'installed'
                ? 'bg-launcher-accent text-white'
                : 'text-launcher-textMuted hover:bg-launcher-card'
            }`}
          >
            {t('modpacks.installed')} ({installedModpacks.length})
          </button>
        </div>

        {/* Search Bar */}
        {activeTab === 'search' && (
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-launcher-textDim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('modpacks.searchPlaceholder')}
                className="input pl-11"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 ${
                showFilters ? 'bg-launcher-accent text-white' : ''
              }`}
            >
              <FiFilter className="w-4 h-4" />
              {t('modpacks.filters')}
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-primary"
            >
              {isSearching ? t('common.loading') : t('common.search')}
            </button>
          </div>
        )}

        {/* Installed tab header */}
        {activeTab === 'installed' && (
          <div className="flex gap-4">
            <button
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdates}
              className="btn-secondary flex items-center gap-2"
            >
              <FiRefreshCw className={`w-4 h-4 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
              {t('modpacks.checkUpdates')}
            </button>
          </div>
        )}

        {/* Filters */}
        <AnimatePresence>
          {showFilters && activeTab === 'search' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-launcher-border">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('modpacks.gameVersion')}</label>
                  <input
                    type="text"
                    value={filters.gameVersion || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, gameVersion: e.target.value })
                    }
                    placeholder="np. 1.20.4"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('modpacks.loader')}</label>
                  <select
                    value={filters.loader || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        loader: e.target.value as LoaderType || undefined,
                      })
                    }
                    className="input"
                  >
                    <option value="">{t('common.all')}</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('modpacks.sortBy')}</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) =>
                      setFilters({ ...filters, sortBy: e.target.value as any })
                    }
                    className="input"
                  >
                    <option value="relevance">{t('mods.sortRelevance')}</option>
                    <option value="downloads">{t('mods.sortDownloads')}</option>
                    <option value="updated">{t('mods.sortUpdated')}</option>
                    <option value="newest">{t('mods.sortName')}</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download progress */}
        {downloadProgress && (
          <div className="mt-4 p-4 bg-launcher-card rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span>{downloadProgress.name}</span>
              <span>{downloadProgress.percentage}%</span>
            </div>
            <div className="w-full bg-launcher-cardHover rounded-full h-2">
              <div
                className="bg-launcher-accent h-2 rounded-full transition-all"
                style={{ width: `${downloadProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'search' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((modpack) => (
              <motion.div
                key={`${modpack.source}-${modpack.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover cursor-pointer"
                onClick={() => handleModpackClick(modpack)}
              >
                <div className="flex gap-4">
                  {modpack.iconUrl ? (
                    <img
                      src={modpack.iconUrl}
                      alt={modpack.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-launcher-cardHover flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-launcher-textDim">
                        {modpack.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{modpack.name}</h3>
                    <p className="text-sm text-launcher-textMuted truncate">
                      by {modpack.author}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-launcher-textDim">
                      <span className="flex items-center gap-1">
                        <FiDownload className="w-4 h-4" />
                        {formatDownloads(modpack.downloads)}
                      </span>
                      <span className="capitalize px-2 py-0.5 bg-launcher-cardHover rounded">
                        {modpack.source}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-launcher-textMuted mt-3 line-clamp-2">
                  {modpack.description}
                </p>
              </motion.div>
            ))}

            {searchResults.length === 0 && !isSearching && (
              <div className="col-span-full text-center py-12 text-launcher-textMuted">
                <FiSearch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('modpacks.searchHint')}</p>
              </div>
            )}

            {isSearching && (
              <div className="col-span-full text-center py-12">
                <div className="w-8 h-8 border-2 border-launcher-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-launcher-textMuted">{t('common.loading')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {installedModpacks.length > 0 ? (
              installedModpacks.map((modpack) => (
                <motion.div
                  key={modpack.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-lg bg-launcher-cardHover flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-launcher-textDim">
                        {modpack.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{modpack.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-launcher-textMuted">
                        <span>v{modpack.version}</span>
                        <span className="capitalize px-2 py-0.5 bg-launcher-cardHover rounded">
                          {modpack.loader}
                        </span>
                        <span>MC {modpack.gameVersion}</span>
                        <span className="text-launcher-textDim">{modpack.source}</span>
                      </div>
                      {modpack.updateAvailable && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-launcher-accent">
                          <FiAlertCircle className="w-4 h-4" />
                          <span>{t('modpacks.updateAvailable')}: {modpack.latestVersion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Play button */}
                    <button
                      onClick={() => handleLaunchModpack(modpack)}
                      disabled={launchingModpackId !== null || !profile}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                      title={t('modpacks.play')}
                    >
                      {launchingModpackId === modpack.id ? (
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiPlay className="w-4 h-4" />
                      )}
                      {t('modpacks.play')}
                    </button>

                    {/* Auto-update toggle */}
                    <button
                      onClick={() => handleToggleAutoUpdate(modpack.id, modpack.autoUpdate)}
                      className={`p-2 rounded-lg transition-colors ${
                        modpack.autoUpdate
                          ? 'text-launcher-accent hover:bg-launcher-accent/20'
                          : 'text-launcher-textMuted hover:bg-launcher-cardHover'
                      }`}
                      title={modpack.autoUpdate ? t('modpacks.autoUpdateOn') : t('modpacks.autoUpdateOff')}
                    >
                      {modpack.autoUpdate ? (
                        <FiToggleRight className="w-5 h-5" />
                      ) : (
                        <FiToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {/* Update button */}
                    {modpack.updateAvailable && (
                      <button
                        onClick={() => handleUpdateModpack(modpack.id)}
                        className="p-2 hover:bg-launcher-accent/20 text-launcher-accent rounded-lg transition-colors"
                        title={t('common.update')}
                      >
                        <FiArrowUp className="w-5 h-5" />
                      </button>
                    )}

                    {/* Uninstall */}
                    <button
                      onClick={() => handleUninstallModpack(modpack.id)}
                      className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
                      title={t('common.uninstall')}
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 text-launcher-textMuted">
                <FiDownload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('modpacks.noInstalled')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modpack Details Modal */}
      <AnimatePresence>
        {selectedModpack && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedModpack(null)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-10 bg-launcher-card border border-launcher-border rounded-xl z-50 flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-launcher-border">
                <div className="flex gap-4">
                  {selectedModpack.iconUrl ? (
                    <img
                      src={selectedModpack.iconUrl}
                      alt={selectedModpack.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-launcher-cardHover flex items-center justify-center">
                      <span className="text-3xl font-bold text-launcher-textDim">
                        {selectedModpack.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{selectedModpack.name}</h2>
                    <p className="text-launcher-textMuted">by {selectedModpack.author}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-sm text-launcher-textDim">
                        <FiDownload className="w-4 h-4" />
                        {formatDownloads(selectedModpack.downloads)} {t('mods.downloads').toLowerCase()}
                      </span>
                      {selectedModpack.websiteUrl && (
                        <button
                          onClick={() => handleOpenExternal(selectedModpack.websiteUrl!)}
                          className="flex items-center gap-1 text-sm text-launcher-accent hover:underline"
                        >
                          <FiExternalLink className="w-4 h-4" />
                          {t('modpacks.website')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedModpack(null)}
                  className="p-2 hover:bg-launcher-cardHover rounded-lg"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              <div className="p-6 border-b border-launcher-border">
                <p className="text-launcher-textMuted">{selectedModpack.description}</p>
              </div>

              {/* Files / Versions */}
              <div className="flex-1 overflow-auto p-6">
                <h3 className="font-semibold mb-4">{t('modpacks.availableVersions')}</h3>
                <div className="space-y-2">
                  {selectedModpackFiles.slice(0, 20).map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-launcher-cardHover rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{file.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-launcher-textMuted mt-1">
                          <span>{file.gameVersions.slice(0, 3).join(', ')}</span>
                          <span className="capitalize">
                            {file.loaders.join(', ')}
                          </span>
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              file.releaseType === 'release'
                                ? 'bg-green-500/20 text-green-400'
                                : file.releaseType === 'beta'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {file.releaseType}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInstallModpack(selectedModpack, file)}
                        className="btn-primary flex items-center gap-2"
                      >
                        <FiDownload className="w-4 h-4" />
                        {t('common.install')}
                      </button>
                    </div>
                  ))}

                  {selectedModpackFiles.length === 0 && (
                    <p className="text-center text-launcher-textMuted py-8">
                      {t('modpacks.noFiles')}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModpacksPage;
