// Minecraft Version Types
export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel: number;
}

export interface MinecraftVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export interface MinecraftVersionDetails {
  id: string;
  type: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: {
    game: (string | ArgumentRule)[];
    jvm: (string | ArgumentRule)[];
  };
  assets: string;
  assetIndex: AssetIndex;
  downloads: Downloads;
  libraries: Library[];
  logging?: LoggingConfig;
  javaVersion?: JavaVersion;
}

export interface ArgumentRule {
  rules?: Rule[];
  value: string | string[];
}

export interface Rule {
  action: 'allow' | 'disallow';
  os?: {
    name?: string;
    arch?: string;
    version?: string;
  };
  features?: Record<string, boolean>;
}

export interface AssetIndex {
  id: string;
  sha1: string;
  size: number;
  totalSize: number;
  url: string;
}

export interface Downloads {
  client: DownloadInfo;
  client_mappings?: DownloadInfo;
  server?: DownloadInfo;
  server_mappings?: DownloadInfo;
}

export interface DownloadInfo {
  sha1: string;
  size: number;
  url: string;
}

export interface Library {
  name: string;
  downloads: {
    artifact?: {
      path: string;
      sha1: string;
      size: number;
      url: string;
    };
    classifiers?: Record<string, {
      path: string;
      sha1: string;
      size: number;
      url: string;
    }>;
  };
  rules?: Rule[];
  natives?: Record<string, string>;
  extract?: {
    exclude: string[];
  };
}

export interface LoggingConfig {
  client: {
    argument: string;
    file: {
      id: string;
      sha1: string;
      size: number;
      url: string;
    };
    type: string;
  };
}

export interface JavaVersion {
  component: string;
  majorVersion: number;
}

// Loader Types
export type LoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge';

export interface LoaderVersion {
  loader: LoaderType;
  version: string;
  minecraftVersion: string;
  stable: boolean;
}

export interface FabricLoaderVersion {
  loader: {
    separator: string;
    build: number;
    maven: string;
    version: string;
    stable: boolean;
  };
  intermediary: {
    maven: string;
    version: string;
    stable: boolean;
  };
  launcherMeta: {
    version: number;
    libraries: {
      client: FabricLibrary[];
      common: FabricLibrary[];
      server: FabricLibrary[];
    };
    mainClass: {
      client: string;
      server: string;
    };
  };
}

export interface FabricLibrary {
  name: string;
  url: string;
  sha1?: string;
  size?: number;
}

export interface ForgeVersion {
  version: string;
  minecraftVersion: string;
  recommended: boolean;
  latest: boolean;
}

export interface NeoForgeVersion {
  version: string;
  minecraftVersion: string;
  stable: boolean;
}

// Mod Types
export interface Mod {
  id: string;
  name: string;
  slug: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl?: string;
  categories: string[];
  source: 'curseforge' | 'modrinth';
  websiteUrl?: string;
  versions: ModVersion[];
}

export interface ModVersion {
  id: string;
  modId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: LoaderType[];
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  dependencies: ModDependency[];
  releaseType: 'release' | 'beta' | 'alpha';
  datePublished: string;
}

export interface ModDependency {
  modId: string;
  type: 'required' | 'optional' | 'incompatible' | 'embedded';
  versionId?: string;
}

export interface InstalledMod {
  id: string;
  name: string;
  version: string;
  fileName: string;
  source: 'curseforge' | 'modrinth' | 'local';
  loader: LoaderType;
  gameVersion: string;
  installedAt: string;
  filePath: string;
}

// User/Auth Types
export interface MinecraftProfile {
  id: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  skins?: Skin[];
  capes?: Cape[];
}

export interface Skin {
  id: string;
  state: string;
  url: string;
  variant: 'CLASSIC' | 'SLIM';
}

export interface Cape {
  id: string;
  state: string;
  url: string;
  alias: string;
}

// Launcher Settings
export interface LauncherSettings {
  minMemory: number;
  maxMemory: number;
  resolution: {
    width: number;
    height: number;
  };
  fullscreen: boolean;
  jvmArguments: string;
  gameDirectory: string;
  javaPath?: string;
  closeOnLaunch: boolean;
  showSnapshots: boolean;
  language: string;
  theme: 'dark' | 'light';
  accentColor: string;
  autoUpdate: boolean;
  checkLoaderUpdates: boolean;
  loaderCheckInterval: number; // minutes
}

// Download Progress
export interface DownloadProgress {
  type: 'version' | 'client' | 'assets' | 'libraries' | 'mod' | 'loader';
  name?: string;
  current?: number;
  total?: number;
  speed?: number;
  percentage: number;
  downloadedFiles?: number;
  totalFiles?: number;
  downloadedBytes?: number;
  totalBytes?: number;
}

// Server Status
export interface MojangServerStatus {
  service: string;
  status: 'green' | 'yellow' | 'red';
}

// IPC Channel Types
export interface IPCChannels {
  // Auth
  'auth:login': () => Promise<MinecraftProfile>;
  'auth:logout': () => Promise<void>;
  'auth:refresh': () => Promise<MinecraftProfile>;
  'auth:getProfile': () => Promise<MinecraftProfile | null>;

  // Versions
  'versions:getAll': () => Promise<MinecraftVersion[]>;
  'versions:getDetails': (versionId: string) => Promise<MinecraftVersionDetails>;
  'versions:getInstalled': () => Promise<string[]>;
  'versions:install': (versionId: string) => Promise<void>;
  'versions:verify': (versionId: string) => Promise<boolean>;

  // Loaders
  'loaders:getAvailable': (minecraftVersion: string) => Promise<LoaderVersion[]>;
  'loaders:install': (loader: LoaderType, minecraftVersion: string, loaderVersion: string) => Promise<void>;
  'loaders:checkUpdates': () => Promise<LoaderVersion[]>;

  // Mods
  'mods:search': (query: string, filters: ModSearchFilters) => Promise<Mod[]>;
  'mods:install': (mod: Mod, version: ModVersion) => Promise<void>;
  'mods:uninstall': (modId: string) => Promise<void>;
  'mods:getInstalled': () => Promise<InstalledMod[]>;
  'mods:checkConflicts': () => Promise<ModConflict[]>;
  'mods:getDependencies': (modVersion: ModVersion) => Promise<ModDependency[]>;

  // Launcher
  'launcher:launch': (config: LaunchConfig) => Promise<void>;
  'launcher:stop': () => Promise<void>;
  'launcher:getStatus': () => Promise<LauncherStatus>;

  // Settings
  'settings:get': () => Promise<LauncherSettings>;
  'settings:set': (settings: Partial<LauncherSettings>) => Promise<void>;

  // Server Status
  'status:getMojang': () => Promise<MojangServerStatus[]>;

  // Updates
  'updater:check': () => Promise<UpdateInfo | null>;
  'updater:download': () => Promise<void>;
  'updater:install': () => Promise<void>;
}

export interface ModSearchFilters {
  gameVersion?: string;
  loader?: LoaderType;
  category?: string;
  source?: 'curseforge' | 'modrinth' | 'all';
  sortBy?: 'relevance' | 'downloads' | 'updated' | 'newest';
  page?: number;
  pageSize?: number;
}

export interface ModConflict {
  mod1: InstalledMod;
  mod2: InstalledMod;
  reason: string;
}

export interface LaunchConfig {
  version: string;
  loader?: LoaderType;
  loaderVersion?: string;
  profile: MinecraftProfile;
  settings: LauncherSettings;
}

export interface LauncherStatus {
  isRunning: boolean;
  currentVersion?: string;
  pid?: number;
  startTime?: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  mandatory: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    callback: string;
  };
}

// Log Types
export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  data?: unknown;
}
