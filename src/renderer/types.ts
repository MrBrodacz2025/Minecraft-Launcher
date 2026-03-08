// Re-export types from shared for renderer use
export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

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

export type LoaderType = 'vanilla' | 'fabric' | 'forge' | 'neoforge';

export interface LoaderVersion {
  loader: LoaderType;
  version: string;
  minecraftVersion: string;
  stable: boolean;
}

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
  loaderCheckInterval: number;
}

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

export interface ServerStatus {
  sessionServer: 'green' | 'yellow' | 'red' | 'unknown';
  authServer: 'green' | 'yellow' | 'red' | 'unknown';
  texturesServer: 'green' | 'yellow' | 'red' | 'unknown';
  apiServer: 'green' | 'yellow' | 'red' | 'unknown';
  allGreen: boolean;
}

export interface MojangServerStatus {
  service: string;
  status: 'green' | 'yellow' | 'red';
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

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  data?: unknown;
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

export interface ModConflict {
  mod1: InstalledMod;
  mod2: InstalledMod;
  reason: string;
}

// Modpack Types
export interface Modpack {
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
  latestFiles: ModpackFile[];
}

export interface ModpackFile {
  id: string;
  modpackId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: LoaderType[];
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  releaseType: 'release' | 'beta' | 'alpha';
  datePublished: string;
}

export interface InstalledModpack {
  id: string;
  name: string;
  version: string;
  fileId: string;
  source: 'curseforge' | 'modrinth';
  loader: LoaderType;
  gameVersion: string;
  installedAt: string;
  installPath: string;
  autoUpdate: boolean;
  latestVersion?: string;
  updateAvailable?: boolean;
}

export interface ModpackSearchFilters {
  gameVersion?: string;
  loader?: LoaderType;
  source?: 'curseforge' | 'modrinth' | 'all';
  sortBy?: 'relevance' | 'downloads' | 'updated' | 'newest';
  page?: number;
  pageSize?: number;
}
