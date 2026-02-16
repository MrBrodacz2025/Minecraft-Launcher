import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiDownload,
  FiTrash2,
  FiFilter,
  FiX,
  FiExternalLink,
  FiAlertTriangle,
  FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

import { useElectronAPI } from '../hooks/useElectronAPI';
import type {
  Mod,
  ModVersion,
  InstalledMod,
  ModConflict,
  ModSearchFilters,
  LauncherSettings,
  LoaderType,
  DownloadProgress as DownloadProgressType,
} from '../types';

interface ModsPageProps {
  settings: LauncherSettings | null;
}

const ModsPage: React.FC<ModsPageProps> = ({ settings }) => {
  const api = useElectronAPI();

  const [activeTab, setActiveTab] = useState<'search' | 'installed'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Mod[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [modsByVersion, setModsByVersion] = useState<Record<string, InstalledMod[]>>({});
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>('all');
  const [conflicts, setConflicts] = useState<ModConflict[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [selectedModVersions, setSelectedModVersions] = useState<ModVersion[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressType | null>(null);
  const [targetGameVersion, setTargetGameVersion] = useState<string>('');

  // Filters
  const [filters, setFilters] = useState<ModSearchFilters>({
    source: 'all',
    sortBy: 'downloads',
    gameVersion: '',
    loader: undefined,
  });

  // Load installed mods
  useEffect(() => {
    loadInstalledMods();
  }, []);

  // Setup download progress listener
  useEffect(() => {
    const unsubscribe = api.on.downloadProgress((progress: DownloadProgressType) => {
      if (progress.type === 'mod') {
        setDownloadProgress(progress);
        if (progress.percentage >= 100) {
          setTimeout(() => {
            setDownloadProgress(null);
            loadInstalledMods();
          }, 500);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loadInstalledMods = async () => {
    try {
      const mods = await api.mods.getInstalled();
      setInstalledMods(mods);

      // Load mods grouped by version
      const byVersion = await api.mods.getByVersion();
      setModsByVersion(byVersion);

      const modConflicts = await api.mods.checkConflicts();
      setConflicts(modConflicts);
    } catch (error) {
      console.error('Failed to load installed mods:', error);
    }
  };

  // Debounce timer ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search with 300ms delay
  const debouncedSearch = useCallback(async (query: string, currentFilters: ModSearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    try {
      const results = await api.mods.search(query, currentFilters);
      setSearchResults(results);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search failed:', error);
        toast.error('Wyszukiwanie nie powiodło się');
      }
    } finally {
      setIsSearching(false);
    }
  }, [api]);

  // Auto-search with debounce when query or filters change
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
    // Clear debounce and search immediately
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    await debouncedSearch(searchQuery, filters);
  };

  const handleModClick = (mod: Mod) => {
    setSelectedMod(mod);
    setSelectedModVersions(mod.versions || []);
  };

  const handleInstallMod = async (mod: Mod, version: ModVersion) => {
    try {
      // Use targetGameVersion if set, otherwise use filters.gameVersion or first compatible version
      const gameVer = targetGameVersion || filters.gameVersion || version.gameVersions[0];
      await api.mods.install(mod, version, gameVer);
      toast.success(`Zainstalowano ${mod.name} dla MC ${gameVer}`);
      setSelectedMod(null);
      loadInstalledMods();
    } catch (error) {
      console.error('Install failed:', error);
      toast.error(`Nie udało się zainstalować ${mod.name}`);
    }
  };

  const handleUninstallMod = async (modId: string) => {
    try {
      await api.mods.uninstall(modId);
      toast.success('Mod został usunięty');
      loadInstalledMods();
    } catch (error) {
      console.error('Uninstall failed:', error);
      toast.error('Nie udało się usunąć moda');
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-launcher-border">
        <h1 className="text-2xl font-bold mb-4">Manager Modów</h1>

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
            Szukaj modów
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'installed'
                ? 'bg-launcher-accent text-white'
                : 'text-launcher-textMuted hover:bg-launcher-card'
            }`}
          >
            Zainstalowane ({installedMods.length})
          </button>
        </div>

        {/* Search Bar (only for search tab) */}
        {activeTab === 'search' && (
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-launcher-textDim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Szukaj modów..."
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
              Filtry
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-primary"
            >
              {isSearching ? 'Szukanie...' : 'Szukaj'}
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
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-launcher-border">
                <div>
                  <label className="block text-sm font-medium mb-2">Źródło</label>
                  <select
                    value={filters.source}
                    onChange={(e) =>
                      setFilters({ ...filters, source: e.target.value as any })
                    }
                    className="input"
                  >
                    <option value="all">Wszystkie</option>
                    <option value="curseforge">CurseForge</option>
                    <option value="modrinth">Modrinth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Wersja gry</label>
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
                  <label className="block text-sm font-medium mb-2">Loader</label>
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
                    <option value="">Wszystkie</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Sortuj</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) =>
                      setFilters({ ...filters, sortBy: e.target.value as any })
                    }
                    className="input"
                  >
                    <option value="relevance">Trafność</option>
                    <option value="downloads">Pobrania</option>
                    <option value="updated">Aktualizacja</option>
                    <option value="newest">Najnowsze</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conflicts Warning */}
        {conflicts.length > 0 && (
          <div className="mt-4 p-4 bg-launcher-warning/10 border border-launcher-warning/30 rounded-lg flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-launcher-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-launcher-warning">Wykryto konflikty modów</h3>
              <p className="text-sm text-launcher-textMuted mt-1">
                Znaleziono {conflicts.length} konflikt(ów). Sprawdź zainstalowane mody.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'search' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((mod) => (
              <motion.div
                key={`${mod.source}-${mod.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover"
                onClick={() => handleModClick(mod)}
              >
                <div className="flex gap-4">
                  {mod.iconUrl ? (
                    <img
                      src={mod.iconUrl}
                      alt={mod.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-launcher-cardHover flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-launcher-textDim">
                        {mod.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{mod.name}</h3>
                    <p className="text-sm text-launcher-textMuted truncate">
                      by {mod.author}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-launcher-textDim">
                      <span className="flex items-center gap-1">
                        <FiDownload className="w-4 h-4" />
                        {formatDownloads(mod.downloads)}
                      </span>
                      <span className="capitalize px-2 py-0.5 bg-launcher-cardHover rounded">
                        {mod.source}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-launcher-textMuted mt-3 line-clamp-2">
                  {mod.description}
                </p>
              </motion.div>
            ))}

            {searchResults.length === 0 && !isSearching && (
              <div className="col-span-full text-center py-12 text-launcher-textMuted">
                <FiSearch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Wyszukaj mody powyżej</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Version filter for installed mods */}
            <div className="flex items-center gap-4 pb-4 border-b border-launcher-border">
              <label className="text-sm font-medium">Filtruj wg wersji:</label>
              <select
                value={selectedVersionFilter}
                onChange={(e) => setSelectedVersionFilter(e.target.value)}
                className="input w-48"
              >
                <option value="all">Wszystkie wersje</option>
                {Object.keys(modsByVersion).sort().reverse().map(ver => (
                  <option key={ver} value={ver}>
                    {ver === 'unknown' ? 'Nieznana' : ver} ({modsByVersion[ver].length})
                  </option>
                ))}
              </select>
            </div>

            {/* Mods grouped by version */}
            {Object.keys(modsByVersion).length > 0 ? (
              Object.entries(modsByVersion)
                .filter(([ver]) => selectedVersionFilter === 'all' || ver === selectedVersionFilter)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([version, versionMods]) => (
                  <div key={version} className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <span className="px-3 py-1 bg-launcher-accent/20 text-launcher-accent rounded-lg">
                        MC {version === 'unknown' ? 'Nieznana wersja' : version}
                      </span>
                      <span className="text-sm text-launcher-textMuted">
                        ({versionMods.length} {versionMods.length === 1 ? 'mod' : 'modów'})
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {versionMods.map((mod) => (
                        <div
                          key={mod.id}
                          className="card flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-launcher-cardHover flex items-center justify-center">
                              <span className="text-xl font-bold text-launcher-textDim">
                                {mod.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{mod.name}</h3>
                              <div className="flex items-center gap-4 text-sm text-launcher-textMuted">
                                <span>v{mod.version}</span>
                                <span className="capitalize px-2 py-0.5 bg-launcher-cardHover rounded">
                                  {mod.loader}
                                </span>
                                <span className="text-launcher-textDim">
                                  {mod.source}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUninstallMod(mod.id)}
                            className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            ) : installedMods.length > 0 ? (
              <div className="space-y-2">
                {installedMods.map((mod) => (
                  <div
                    key={mod.id}
                    className="card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-launcher-cardHover flex items-center justify-center">
                        <span className="text-xl font-bold text-launcher-textDim">
                          {mod.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{mod.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-launcher-textMuted">
                          <span>v{mod.version}</span>
                          <span className="capitalize">{mod.loader}</span>
                          <span>{mod.gameVersion}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUninstallMod(mod.id)}
                      className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-launcher-textMuted">
                <FiDownload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Brak zainstalowanych modów</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mod Details Modal */}
      <AnimatePresence>
        {selectedMod && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMod(null)}
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
                  {selectedMod.iconUrl ? (
                    <img
                      src={selectedMod.iconUrl}
                      alt={selectedMod.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-launcher-cardHover flex items-center justify-center">
                      <span className="text-3xl font-bold text-launcher-textDim">
                        {selectedMod.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{selectedMod.name}</h2>
                    <p className="text-launcher-textMuted">by {selectedMod.author}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-sm text-launcher-textDim">
                        <FiDownload className="w-4 h-4" />
                        {formatDownloads(selectedMod.downloads)} pobrań
                      </span>
                      {selectedMod.websiteUrl && (
                        <button
                          onClick={() => handleOpenExternal(selectedMod.websiteUrl!)}
                          className="flex items-center gap-1 text-sm text-launcher-accent hover:underline"
                        >
                          <FiExternalLink className="w-4 h-4" />
                          Strona moda
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMod(null)}
                  className="p-2 hover:bg-launcher-cardHover rounded-lg"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              <div className="p-6 border-b border-launcher-border">
                <p className="text-launcher-textMuted">{selectedMod.description}</p>
              </div>

              {/* Versions */}
              <div className="flex-1 overflow-auto p-6">
                <h3 className="font-semibold mb-4">Dostępne wersje</h3>
                <div className="space-y-2">
                  {selectedModVersions.slice(0, 20).map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-4 bg-launcher-cardHover rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{version.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-launcher-textMuted mt-1">
                          <span>{version.gameVersions.slice(0, 3).join(', ')}</span>
                          <span className="capitalize">
                            {version.loaders.join(', ')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              version.releaseType === 'release'
                                ? 'bg-green-500/20 text-green-400'
                                : version.releaseType === 'beta'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {version.releaseType}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInstallMod(selectedMod, version)}
                        disabled={downloadProgress !== null}
                        className="btn-primary py-2"
                      >
                        <FiDownload className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Progress */}
              {downloadProgress && (
                <div className="p-6 border-t border-launcher-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Pobieranie {downloadProgress.name}...</span>
                    <span className="text-sm text-launcher-textMuted">
                      {downloadProgress.percentage}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${downloadProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModsPage;
