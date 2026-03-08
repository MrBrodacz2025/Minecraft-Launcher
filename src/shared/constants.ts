import * as path from 'path';
import * as os from 'os';

// API Endpoints
export const MINECRAFT_VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
export const MINECRAFT_RESOURCES_URL = 'https://resources.download.minecraft.net';
export const MINECRAFT_LIBRARIES_URL = 'https://libraries.minecraft.net';

// Fabric API
export const FABRIC_API_URL = 'https://meta.fabricmc.net/v2';
export const FABRIC_VERSIONS_URL = `${FABRIC_API_URL}/versions`;
export const FABRIC_LOADER_URL = `${FABRIC_API_URL}/versions/loader`;

// Forge API
export const FORGE_API_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge';
export const FORGE_MAVEN_URL = 'https://maven.minecraftforge.net';
export const FORGE_PROMOTIONS_URL = `${FORGE_API_URL}/promotions_slim.json`;

// NeoForge API
export const NEOFORGE_API_URL = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
export const NEOFORGE_MAVEN_URL = 'https://maven.neoforged.net/releases';

// CurseForge API
export const CURSEFORGE_API_URL = 'https://api.curseforge.com/v1';
export const CURSEFORGE_API_KEY = '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm'; // Public API key
export const CURSEFORGE_MINECRAFT_ID = 432;

// Modrinth API
export const MODRINTH_API_URL = 'https://api.modrinth.com/v2';

// Mojang Status API
export const MOJANG_STATUS_URL = 'https://status.mojang.com/check';
export const MOJANG_AUTH_URL = 'https://authserver.mojang.com';

// Microsoft Auth
export const MICROSOFT_CLIENT_ID = '00000000402b5328'; // Minecraft default client ID
export const MICROSOFT_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';

// Paths
export const getDefaultGameDirectory = (): string => {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || '', '.minecraft');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft');
    case 'linux':
      return path.join(os.homedir(), '.minecraft');
    default:
      return path.join(os.homedir(), '.minecraft');
  }
};

export const getLauncherDirectory = (): string => {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || '', 'EnderGate');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'EnderGate');
    case 'linux':
      return path.join(os.homedir(), '.config', 'EnderGate');
    default:
      return path.join(os.homedir(), '.endergate');
  }
};

// Default Settings
export const DEFAULT_SETTINGS = {
  minMemory: 2048,
  maxMemory: 4096,
  resolution: {
    width: 854,
    height: 480,
  },
  fullscreen: false,
  jvmArguments: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
  gameDirectory: getDefaultGameDirectory(),
  closeOnLaunch: false,
  showSnapshots: false,
  language: 'pl',
  theme: 'dark' as const,
  accentColor: '#3B82F6',
  autoUpdate: true,
  checkLoaderUpdates: true,
  loaderCheckInterval: 60,
};

// Version Constraints
export const MIN_MINECRAFT_VERSION = '1.17.2';
export const MIN_JAVA_VERSION = 17;

// IPC Channels
export const IPC_CHANNELS = {
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

// Loader Check Intervals
export const LOADER_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Download Settings
export const MAX_CONCURRENT_DOWNLOADS = 5;
export const DOWNLOAD_TIMEOUT = 30000;
export const DOWNLOAD_RETRY_COUNT = 3;

// Cache TTL
export const VERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const LOADER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
export const MOD_SEARCH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// File Names
export const SETTINGS_FILE = 'settings.json';
export const AUTH_FILE = 'auth.json';
export const INSTALLED_MODS_FILE = 'installed-mods.json';
export const VERSION_CACHE_FILE = 'version-cache.json';
