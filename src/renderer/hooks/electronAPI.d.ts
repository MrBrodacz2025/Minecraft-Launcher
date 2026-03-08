import type {
  MinecraftProfile,
  MinecraftVersion,
  LoaderVersion,
  LoaderType,
  Mod,
  ModVersion,
  ModSearchFilters,
  InstalledMod,
  ModConflict,
  ModDependency,
  Modpack,
  ModpackFile,
  ModpackSearchFilters,
  InstalledModpack,
  LaunchConfig,
  LauncherStatus,
  LauncherSettings,
  MojangServerStatus,
  DownloadProgress,
  Notification,
  LogEntry,
  UpdateInfo,
} from '../types';

// Type definition for Electron API exposed via preload
export interface ElectronAPI {
  // Auth
  auth: {
    login: () => Promise<MinecraftProfile>;
    logout: () => Promise<void>;
    refresh: () => Promise<MinecraftProfile>;
    getProfile: () => Promise<MinecraftProfile | null>;
  };

  // Versions
  versions: {
    getAll: () => Promise<MinecraftVersion[]>;
    getDetails: (versionId: string) => Promise<any>;
    getInstalled: () => Promise<string[]>;
    install: (versionId: string) => Promise<void>;
    verify: (versionId: string) => Promise<boolean>;
  };

  // Loaders
  loaders: {
    getAvailable: (minecraftVersion: string) => Promise<LoaderVersion[]>;
    install: (loader: LoaderType, minecraftVersion: string, loaderVersion: string) => Promise<void>;
    checkUpdates: () => Promise<LoaderVersion[]>;
  };

  // Mods
  mods: {
    search: (query: string, filters: ModSearchFilters) => Promise<Mod[]>;
    install: (mod: Mod, version: ModVersion, gameVersion?: string) => Promise<void>;
    uninstall: (modId: string) => Promise<void>;
    getInstalled: () => Promise<InstalledMod[]>;
    checkConflicts: () => Promise<ModConflict[]>;
    getDependencies: (modVersion: ModVersion) => Promise<ModDependency[]>;
    getByVersion: () => Promise<Record<string, InstalledMod[]>>;
    scanFolders: () => Promise<{ version: string; files: string[] }[]>;
    organize: (version: string) => Promise<void>;
    activateVersion: (version: string) => Promise<void>;
  };

  // Modpacks
  modpacks: {
    search: (query: string, filters: ModpackSearchFilters) => Promise<Modpack[]>;
    getDetails: (modpackId: string, source: 'curseforge' | 'modrinth') => Promise<Modpack | null>;
    getFiles: (modpackId: string, source: 'curseforge' | 'modrinth', gameVersion?: string) => Promise<ModpackFile[]>;
    install: (modpack: Modpack, file: ModpackFile) => Promise<void>;
    uninstall: (modpackId: string) => Promise<void>;
    getInstalled: () => Promise<InstalledModpack[]>;
    checkUpdates: () => Promise<InstalledModpack[]>;
    update: (modpackId: string) => Promise<void>;
    setAutoUpdate: (modpackId: string, enabled: boolean) => Promise<void>;
  };

  // Java Management
  java: {
    getInstalled: () => Promise<{ version: number; path: string; vendor: string; installed: boolean }[]>;
    getRequired: (mcVersion: string) => Promise<number>;
    download: (version: number) => Promise<string>;
    ensure: (mcVersion: string) => Promise<string>;
  };

  // Launcher
  launcher: {
    launch: (config: LaunchConfig) => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<LauncherStatus>;
  };

  // Settings
  settings: {
    get: () => Promise<LauncherSettings>;
    set: (settings: Partial<LauncherSettings>) => Promise<void>;
  };

  // Server Status
  status: {
    getMojang: () => Promise<MojangServerStatus[]>;
  };

  // Updater
  updater: {
    check: () => Promise<UpdateInfo | null>;
    download: () => Promise<void>;
    install: () => Promise<void>;
  };

  // Event listeners (Main -> Renderer)
  on: {
    downloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
    gameLog: (callback: (log: LogEntry) => void) => () => void;
    gameExit: (callback: (code: number) => void) => () => void;
    notification: (callback: (notification: Notification) => void) => () => void;
    loaderUpdateAvailable: (callback: (loaders: LoaderVersion[]) => void) => () => void;
  };

  // Window controls
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };

  // Utils
  utils: {
    openExternal: (url: string) => Promise<void>;
    selectDirectory: () => Promise<string | null>;
    selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    getAppVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
