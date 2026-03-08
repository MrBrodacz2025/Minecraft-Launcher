import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// IPC Channels - inlined to avoid module resolution issues
const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_GET_PROFILE: 'auth:getProfile',

  // Versions
  VERSIONS_GET_ALL: 'versions:getAll',
  VERSIONS_GET_DETAILS: 'versions:getDetails',
  VERSIONS_GET_INSTALLED: 'versions:getInstalled',
  VERSIONS_INSTALL: 'versions:install',
  VERSIONS_VERIFY: 'versions:verify',

  // Loaders
  LOADERS_GET_AVAILABLE: 'loaders:getAvailable',
  LOADERS_INSTALL: 'loaders:install',
  LOADERS_CHECK_UPDATES: 'loaders:checkUpdates',

  // Mods
  MODS_SEARCH: 'mods:search',
  MODS_INSTALL: 'mods:install',
  MODS_UNINSTALL: 'mods:uninstall',
  MODS_GET_INSTALLED: 'mods:getInstalled',
  MODS_CHECK_CONFLICTS: 'mods:checkConflicts',
  MODS_GET_DEPENDENCIES: 'mods:getDependencies',
  MODS_GET_BY_VERSION: 'mods:getByVersion',
  MODS_SCAN_FOLDERS: 'mods:scanFolders',
  MODS_ORGANIZE: 'mods:organize',
  MODS_ACTIVATE_VERSION: 'mods:activateVersion',

  // Modpacks
  MODPACKS_SEARCH: 'modpacks:search',
  MODPACKS_GET_DETAILS: 'modpacks:getDetails',
  MODPACKS_GET_FILES: 'modpacks:getFiles',
  MODPACKS_INSTALL: 'modpacks:install',
  MODPACKS_UNINSTALL: 'modpacks:uninstall',
  MODPACKS_GET_INSTALLED: 'modpacks:getInstalled',
  MODPACKS_CHECK_UPDATES: 'modpacks:checkUpdates',
  MODPACKS_UPDATE: 'modpacks:update',
  MODPACKS_SET_AUTO_UPDATE: 'modpacks:setAutoUpdate',

  // Launcher
  LAUNCHER_LAUNCH: 'launcher:launch',
  LAUNCHER_STOP: 'launcher:stop',
  LAUNCHER_GET_STATUS: 'launcher:getStatus',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Server Status
  STATUS_GET_MOJANG: 'status:getMojang',

  // Java Management
  JAVA_GET_INSTALLED: 'java:getInstalled',
  JAVA_GET_REQUIRED: 'java:getRequired',
  JAVA_DOWNLOAD: 'java:download',
  JAVA_ENSURE: 'java:ensure',

  // Updates
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',

  // Events (Main -> Renderer)
  DOWNLOAD_PROGRESS: 'download:progress',
  GAME_LOG: 'game:log',
  GAME_EXIT: 'game:exit',
  NOTIFICATION: 'notification',
  LOADER_UPDATE_AVAILABLE: 'loader:updateAvailable',
} as const;

// Type-safe API exposed to renderer
const electronAPI = {
  // Auth
  auth: {
    login: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN),
    logout: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    refresh: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REFRESH),
    getProfile: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_PROFILE),
  },

  // Versions
  versions: {
    getAll: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_GET_ALL),
    getDetails: (versionId: string): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_GET_DETAILS, versionId),
    getInstalled: (): Promise<string[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_GET_INSTALLED),
    install: (versionId: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_INSTALL, versionId),
    verify: (versionId: string): Promise<boolean> => 
      ipcRenderer.invoke(IPC_CHANNELS.VERSIONS_VERIFY, versionId),
  },

  // Loaders
  loaders: {
    getAvailable: (minecraftVersion: string): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.LOADERS_GET_AVAILABLE, minecraftVersion),
    install: (loader: string, minecraftVersion: string, loaderVersion: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.LOADERS_INSTALL, loader, minecraftVersion, loaderVersion),
    checkUpdates: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.LOADERS_CHECK_UPDATES),
  },

  // Mods
  mods: {
    search: (query: string, filters: any): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_SEARCH, query, filters),
    install: (mod: any, version: any, gameVersion?: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_INSTALL, mod, version, gameVersion),
    uninstall: (modId: string): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_UNINSTALL, modId),
    getInstalled: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_GET_INSTALLED),
    checkConflicts: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_CHECK_CONFLICTS),
    getDependencies: (modVersion: any): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.MODS_GET_DEPENDENCIES, modVersion),
    getByVersion: (): Promise<Record<string, any[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODS_GET_BY_VERSION),
    scanFolders: (): Promise<{ version: string; files: string[] }[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODS_SCAN_FOLDERS),
    organize: (version: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODS_ORGANIZE, version),
    activateVersion: (version: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODS_ACTIVATE_VERSION, version),
  },

  // Modpacks
  modpacks: {
    search: (query: string, filters: any): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_SEARCH, query, filters),
    getDetails: (modpackId: string, source: string): Promise<any> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_GET_DETAILS, modpackId, source),
    getFiles: (modpackId: string, source: string, gameVersion?: string): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_GET_FILES, modpackId, source, gameVersion),
    install: (modpack: any, file: any): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_INSTALL, modpack, file),
    uninstall: (modpackId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_UNINSTALL, modpackId),
    getInstalled: (): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_GET_INSTALLED),
    checkUpdates: (): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_CHECK_UPDATES),
    update: (modpackId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_UPDATE, modpackId),
    setAutoUpdate: (modpackId: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACKS_SET_AUTO_UPDATE, modpackId, enabled),
  },

  // Launcher
  launcher: {
    launch: (config: any): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.LAUNCHER_LAUNCH, config),
    stop: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.LAUNCHER_STOP),
    getStatus: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.LAUNCHER_GET_STATUS),
  },

  // Settings
  settings: {
    get: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (settings: any): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  },

  // Server Status
  status: {
    getMojang: (): Promise<any[]> => 
      ipcRenderer.invoke(IPC_CHANNELS.STATUS_GET_MOJANG),
  },

  // Java Management
  java: {
    getInstalled: (): Promise<any[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.JAVA_GET_INSTALLED),
    getRequired: (mcVersion: string): Promise<number> =>
      ipcRenderer.invoke(IPC_CHANNELS.JAVA_GET_REQUIRED, mcVersion),
    download: (version: number): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.JAVA_DOWNLOAD, version),
    ensure: (mcVersion: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.JAVA_ENSURE, mcVersion),
  },

  // Updater
  updater: {
    check: (): Promise<any> => 
      ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    download: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    install: (): Promise<void> => 
      ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
  },

  // Event listeners (Main -> Renderer)
  on: {
    downloadProgress: (callback: (progress: any) => void) => {
      const handler = (_event: IpcRendererEvent, progress: any) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler);
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler); };
    },
    gameLog: (callback: (log: any) => void) => {
      const handler = (_event: IpcRendererEvent, log: any) => callback(log);
      ipcRenderer.on(IPC_CHANNELS.GAME_LOG, handler);
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.GAME_LOG, handler); };
    },
    gameExit: (callback: (code: number) => void) => {
      const handler = (_event: IpcRendererEvent, code: number) => callback(code);
      ipcRenderer.on(IPC_CHANNELS.GAME_EXIT, handler);
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.GAME_EXIT, handler); };
    },
    notification: (callback: (notification: any) => void) => {
      const handler = (_event: IpcRendererEvent, notification: any) => callback(notification);
      ipcRenderer.on(IPC_CHANNELS.NOTIFICATION, handler);
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION, handler); };
    },
    loaderUpdateAvailable: (callback: (loaders: any[]) => void) => {
      const handler = (_event: IpcRendererEvent, loaders: any[]) => callback(loaders);
      ipcRenderer.on(IPC_CHANNELS.LOADER_UPDATE_AVAILABLE, handler);
      return () => { ipcRenderer.removeListener(IPC_CHANNELS.LOADER_UPDATE_AVAILABLE, handler); };
    },
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  },

  // Utils
  utils: {
    openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url),
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('utils:selectDirectory'),
    selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => 
      ipcRenderer.invoke('utils:selectFile', options),
    getAppVersion: (): Promise<string> => ipcRenderer.invoke('utils:getAppVersion'),
    getPlatform: (): Promise<string> => ipcRenderer.invoke('utils:getPlatform'),
  },

  // Discord RPC
  discord: {
    setInLauncher: (): Promise<boolean> => ipcRenderer.invoke('discord:setInLauncher'),
    setDownloading: (version: string, progress?: number): Promise<boolean> => 
      ipcRenderer.invoke('discord:setDownloading', version, progress),
    setPlaying: (version: string, serverName?: string): Promise<boolean> => 
      ipcRenderer.invoke('discord:setPlaying', version, serverName),
    setBrowsingMods: (): Promise<boolean> => ipcRenderer.invoke('discord:setBrowsingMods'),
    setInSettings: (): Promise<boolean> => ipcRenderer.invoke('discord:setInSettings'),
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer
export type ElectronAPI = typeof electronAPI;
