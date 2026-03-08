import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron';
import log from 'electron-log';
import { z } from 'zod';

import { IPC_CHANNELS } from '../shared/constants';
import { AuthService } from '../services/AuthService';
import { VersionManager } from '../services/VersionManager';
import { LoaderManager } from '../loader-manager/LoaderManager';
import { ModManager } from '../mod-manager/ModManager';
import { ModpackManager } from '../mod-manager/ModpackManager';
import { MinecraftLauncherService } from '../services/MinecraftLauncherService';
import { SettingsService } from '../services/SettingsService';
import { StatusService } from '../services/StatusService';
import { UpdaterService } from '../updater/UpdaterService';
import { discordRPC } from '../services/DiscordRPCService';
import {
  validateIpcParam,
  versionIdSchema,
  loaderTypeSchema,
  settingsSchema,
  modSearchFiltersSchema,
  modpackSearchFiltersSchema,
  modSchema,
  modVersionSchema,
  modpackSchema,
  modpackFileSchema,
  launchConfigSchema,
  sourceSchema,
} from './ipc-validators';
import type {
  LaunchConfig,
  ModSearchFilters,
  ModpackSearchFilters,
  Mod,
  ModVersion,
  Modpack,
  ModpackFile,
  LoaderType,
  LauncherSettings,
} from '../shared/types';

// Service instances
let authService: AuthService;
let versionManager: VersionManager;
let loaderManager: LoaderManager;
let modManager: ModManager;
let modpackManager: ModpackManager;
let launcherService: MinecraftLauncherService;
let settingsService: SettingsService;
let statusService: StatusService;

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Initialize services
  authService = new AuthService();
  settingsService = new SettingsService();
  versionManager = new VersionManager();
  loaderManager = new LoaderManager();
  modManager = new ModManager(settingsService);
  modpackManager = new ModpackManager(settingsService);
  launcherService = new MinecraftLauncherService(mainWindow);
  statusService = new StatusService();

  // ==================== AUTH ====================
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async () => {
    try {
      log.info('Auth: Starting login process');
      return await authService.login();
    } catch (error) {
      log.error('Auth: Login failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    try {
      log.info('Auth: Logging out');
      await authService.logout();
    } catch (error) {
      log.error('Auth: Logout failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_REFRESH, async () => {
    try {
      log.info('Auth: Refreshing token');
      return await authService.refresh();
    } catch (error) {
      log.error('Auth: Token refresh failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_PROFILE, async () => {
    try {
      return await authService.getProfile();
    } catch (error) {
      log.error('Auth: Get profile failed', error);
      return null;
    }
  });

  // ==================== VERSIONS ====================
  ipcMain.handle(IPC_CHANNELS.VERSIONS_GET_ALL, async () => {
    try {
      return await versionManager.getAllVersions();
    } catch (error) {
      log.error('Versions: Get all failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERSIONS_GET_DETAILS, async (_event, versionId: unknown) => {
    try {
      const id = validateIpcParam(versionIdSchema, versionId, 'versionId');
      return await versionManager.getVersionDetails(id);
    } catch (error) {
      log.error('Versions: Get details failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERSIONS_GET_INSTALLED, async () => {
    try {
      return await versionManager.getInstalledVersions();
    } catch (error) {
      log.error('Versions: Get installed failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERSIONS_INSTALL, async (_event, versionId: unknown) => {
    try {
      const id = validateIpcParam(versionIdSchema, versionId, 'versionId');
      log.info(`Versions: Installing version ${id}`);
      await versionManager.installVersion(id, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Versions: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERSIONS_VERIFY, async (_event, versionId: unknown) => {
    try {
      const id = validateIpcParam(versionIdSchema, versionId, 'versionId');
      return await versionManager.verifyVersion(id);
    } catch (error) {
      log.error('Versions: Verify failed', error);
      throw error;
    }
  });

  // ==================== LOADERS ====================
  ipcMain.handle(IPC_CHANNELS.LOADERS_GET_AVAILABLE, async (_event, minecraftVersion: unknown) => {
    try {
      const mcVersion = validateIpcParam(versionIdSchema, minecraftVersion, 'minecraftVersion');
      return await loaderManager.getAvailableLoaders(mcVersion);
    } catch (error) {
      log.error('Loaders: Get available failed', error);
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.LOADERS_INSTALL,
    async (_event, loader: unknown, minecraftVersion: unknown, loaderVersion: unknown) => {
      try {
        const validLoader = validateIpcParam(loaderTypeSchema, loader, 'loader');
        const mcVersion = validateIpcParam(versionIdSchema, minecraftVersion, 'minecraftVersion');
        const ldrVersion = validateIpcParam(versionIdSchema, loaderVersion, 'loaderVersion');
        log.info(`Loaders: Installing ${validLoader} ${ldrVersion} for MC ${mcVersion}`);
        await loaderManager.installLoader(validLoader, mcVersion, ldrVersion, (progress) => {
          mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
        });
      } catch (error) {
        log.error('Loaders: Install failed', error);
        throw error;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.LOADERS_CHECK_UPDATES, async () => {
    try {
      return await loaderManager.checkForUpdates();
    } catch (error) {
      log.error('Loaders: Check updates failed', error);
      throw error;
    }
  });

  // ==================== MODS ====================
  ipcMain.handle(IPC_CHANNELS.MODS_SEARCH, async (_event, query: unknown, filters: unknown) => {
    try {
      const validQuery = validateIpcParam(z.string().min(0).max(200), query, 'query');
      const validFilters = validateIpcParam(modSearchFiltersSchema, filters, 'filters');
      return await modManager.searchMods(validQuery, validFilters as ModSearchFilters);
    } catch (error) {
      log.error('Mods: Search failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_INSTALL, async (_event, mod: unknown, version: unknown, gameVersion?: unknown) => {
    try {
      const validMod = validateIpcParam(modSchema, mod, 'mod');
      const validVersion = validateIpcParam(modVersionSchema, version, 'modVersion');
      const validGameVersion = gameVersion ? validateIpcParam(z.string().max(50), gameVersion, 'gameVersion') : undefined;
      log.info(`Mods: Installing ${validMod.name} version ${validVersion.versionNumber} for MC ${validGameVersion || 'auto'}`);
      await modManager.installMod(validMod as Mod, validVersion as ModVersion, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      }, validGameVersion);
    } catch (error) {
      log.error('Mods: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_UNINSTALL, async (_event, modId: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modId, 'modId');
      log.info(`Mods: Uninstalling mod ${id}`);
      await modManager.uninstallMod(id);
    } catch (error) {
      log.error('Mods: Uninstall failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_GET_INSTALLED, async () => {
    try {
      return await modManager.getInstalledMods();
    } catch (error) {
      log.error('Mods: Get installed failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_CHECK_CONFLICTS, async () => {
    try {
      return await modManager.checkConflicts();
    } catch (error) {
      log.error('Mods: Check conflicts failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_GET_DEPENDENCIES, async (_event, modVersion: unknown) => {
    try {
      const validVersion = validateIpcParam(modVersionSchema, modVersion, 'modVersion');
      return await modManager.getDependencies(validVersion as ModVersion);
    } catch (error) {
      log.error('Mods: Get dependencies failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_GET_BY_VERSION, async () => {
    try {
      const grouped = await modManager.getModsByVersion();
      // Convert Map to object for IPC
      const result: Record<string, any[]> = {};
      grouped.forEach((mods, version) => {
        result[version] = mods;
      });
      return result;
    } catch (error) {
      log.error('Mods: Get by version failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_SCAN_FOLDERS, async () => {
    try {
      return await modManager.scanModsFolders();
    } catch (error) {
      log.error('Mods: Scan folders failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_ORGANIZE, async (_event, version: unknown) => {
    try {
      const validVersion = validateIpcParam(z.string().min(1).max(50), version, 'version');
      await modManager.organizeMods(validVersion);
    } catch (error) {
      log.error('Mods: Organize failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_ACTIVATE_VERSION, async (_event, version: unknown) => {
    try {
      const validVersion = validateIpcParam(z.string().min(1).max(50), version, 'version');
      await modManager.activateModsForVersion(validVersion);
    } catch (error) {
      log.error('Mods: Activate version failed', error);
      throw error;
    }
  });

  // ==================== MODPACKS ====================
  ipcMain.handle(IPC_CHANNELS.MODPACKS_SEARCH, async (_event, query: unknown, filters: unknown) => {
    try {
      const validQuery = validateIpcParam(z.string().min(0).max(200), query, 'query');
      const validFilters = validateIpcParam(modpackSearchFiltersSchema, filters, 'filters');
      return await modpackManager.searchModpacks(validQuery, validFilters as ModpackSearchFilters);
    } catch (error) {
      log.error('Modpacks: Search failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_GET_DETAILS, async (_event, modpackId: unknown, source: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modpackId, 'modpackId');
      const validSource = validateIpcParam(sourceSchema, source, 'source');
      return await modpackManager.getModpackDetails(id, validSource);
    } catch (error) {
      log.error('Modpacks: Get details failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_GET_FILES, async (_event, modpackId: unknown, source: unknown, gameVersion?: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modpackId, 'modpackId');
      const validSource = validateIpcParam(sourceSchema, source, 'source');
      const validGameVersion = gameVersion ? validateIpcParam(z.string().max(50), gameVersion, 'gameVersion') : undefined;
      return await modpackManager.getModpackFiles(id, validSource, validGameVersion);
    } catch (error) {
      log.error('Modpacks: Get files failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_INSTALL, async (_event, modpack: unknown, file: unknown) => {
    try {
      const validModpack = validateIpcParam(modpackSchema, modpack, 'modpack');
      const validFile = validateIpcParam(modpackFileSchema, file, 'modpackFile');
      log.info(`Modpacks: Installing ${validModpack.name}`);
      await modpackManager.installModpack(validModpack as Modpack, validFile as ModpackFile, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Modpacks: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_UNINSTALL, async (_event, modpackId: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modpackId, 'modpackId');
      log.info(`Modpacks: Uninstalling modpack ${id}`);
      await modpackManager.uninstallModpack(id);
    } catch (error) {
      log.error('Modpacks: Uninstall failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_GET_INSTALLED, async () => {
    try {
      return await modpackManager.getInstalledModpacks();
    } catch (error) {
      log.error('Modpacks: Get installed failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_CHECK_UPDATES, async () => {
    try {
      return await modpackManager.checkForUpdates();
    } catch (error) {
      log.error('Modpacks: Check updates failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_UPDATE, async (_event, modpackId: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modpackId, 'modpackId');
      log.info(`Modpacks: Updating modpack ${id}`);
      await modpackManager.updateModpack(id, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Modpacks: Update failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_SET_AUTO_UPDATE, async (_event, modpackId: unknown, enabled: unknown) => {
    try {
      const id = validateIpcParam(z.string().min(1).max(200), modpackId, 'modpackId');
      const validEnabled = validateIpcParam(z.boolean(), enabled, 'enabled');
      await modpackManager.setAutoUpdate(id, validEnabled);
    } catch (error) {
      log.error('Modpacks: Set auto update failed', error);
      throw error;
    }
  });

  // ==================== LAUNCHER ====================
  ipcMain.handle(IPC_CHANNELS.LAUNCHER_LAUNCH, async (_event, config: unknown) => {
    try {
      const validConfig = validateIpcParam(launchConfigSchema, config, 'launchConfig');
      log.info(`Launcher: Launching Minecraft ${validConfig.version}`);
      await launcherService.launch(validConfig as LaunchConfig);
    } catch (error) {
      log.error('Launcher: Launch failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LAUNCHER_STOP, async () => {
    try {
      log.info('Launcher: Stopping game');
      await launcherService.stop();
    } catch (error) {
      log.error('Launcher: Stop failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LAUNCHER_GET_STATUS, async () => {
    try {
      return launcherService.getStatus();
    } catch (error) {
      log.error('Launcher: Get status failed', error);
      throw error;
    }
  });

  // ==================== SETTINGS ====================
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      return await settingsService.getSettings();
    } catch (error) {
      log.error('Settings: Get failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings: unknown) => {
    try {
      const validSettings = validateIpcParam(settingsSchema, settings, 'settings');
      await settingsService.setSettings(validSettings as Partial<LauncherSettings>);
    } catch (error) {
      log.error('Settings: Set failed', error);
      throw error;
    }
  });

  // ==================== STATUS ====================
  ipcMain.handle(IPC_CHANNELS.STATUS_GET_MOJANG, async () => {
    try {
      return await statusService.getMojangStatus();
    } catch (error) {
      log.error('Status: Get Mojang status failed', error);
      throw error;
    }
  });

  // ==================== JAVA ====================
  ipcMain.handle(IPC_CHANNELS.JAVA_GET_INSTALLED, async () => {
    try {
      const { javaService } = await import('../services/JavaService');
      return javaService.getInstalledVersions();
    } catch (error) {
      log.error('Java: Get installed failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JAVA_GET_REQUIRED, async (_event, mcVersion: unknown) => {
    try {
      const validVersion = validateIpcParam(versionIdSchema, mcVersion, 'mcVersion');
      const { javaService } = await import('../services/JavaService');
      return javaService.getRequiredJavaVersion(validVersion);
    } catch (error) {
      log.error('Java: Get required failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JAVA_DOWNLOAD, async (_event, version: unknown) => {
    try {
      const validVersion = validateIpcParam(z.number().int().min(8).max(99), version, 'javaVersion');
      const { javaService } = await import('../services/JavaService');
      return await javaService.downloadJava(validVersion, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
          type: 'java',
          filename: `Java ${validVersion}`,
          downloaded: progress.downloaded,
          total: progress.total,
          percentage: progress.percentage,
        });
      });
    } catch (error) {
      log.error('Java: Download failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JAVA_ENSURE, async (_event, mcVersion: unknown) => {
    try {
      const validVersion = validateIpcParam(versionIdSchema, mcVersion, 'mcVersion');
      const { javaService } = await import('../services/JavaService');
      return await javaService.ensureJavaForMinecraft(validVersion, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
          type: 'java',
          filename: `Java dla MC ${validVersion}`,
          downloaded: progress.downloaded,
          total: progress.total,
          percentage: progress.percentage,
        });
      });
    } catch (error) {
      log.error('Java: Ensure failed', error);
      throw error;
    }
  });

  // ==================== UPDATER ====================
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK, async () => {
    try {
      const updater = new UpdaterService();
      return await updater.checkForUpdates();
    } catch (error) {
      log.error('Updater: Check failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async () => {
    try {
      const updater = new UpdaterService();
      await updater.downloadUpdate();
    } catch (error) {
      log.error('Updater: Download failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, async () => {
    try {
      const updater = new UpdaterService();
      updater.installUpdate();
    } catch (error) {
      log.error('Updater: Install failed', error);
      throw error;
    }
  });

  // ==================== WINDOW ====================
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow.isMaximized();
  });

  // ==================== UTILS ====================
  ipcMain.handle('utils:openExternal', async (_event, url: string) => {
    // VULN-001: Validate URL protocol — only allow HTTP(S)
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        log.warn(`Blocked openExternal with disallowed protocol: ${parsed.protocol}`);
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }
      await shell.openExternal(url);
    } catch (error) {
      if (error instanceof TypeError) {
        log.warn(`Blocked openExternal with invalid URL: ${url}`);
        throw new Error('Invalid URL');
      }
      throw error;
    }
  });

  ipcMain.handle('utils:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('utils:selectFile', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('utils:getAppVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('utils:getPlatform', () => {
    return process.platform;
  });

  // ==================== DISCORD RPC ====================
  ipcMain.handle('discord:setInLauncher', async () => {
    try {
      await discordRPC.setInLauncher();
      return true;
    } catch (error) {
      log.warn('Discord RPC setInLauncher failed:', error);
      return false;
    }
  });

  ipcMain.handle('discord:setDownloading', async (_event, version: string, progress?: number) => {
    try {
      await discordRPC.setDownloading(version, progress);
      return true;
    } catch (error) {
      log.warn('Discord RPC setDownloading failed:', error);
      return false;
    }
  });

  ipcMain.handle('discord:setPlaying', async (_event, version: string, serverName?: string) => {
    try {
      await discordRPC.setPlaying(version, serverName);
      return true;
    } catch (error) {
      log.warn('Discord RPC setPlaying failed:', error);
      return false;
    }
  });

  ipcMain.handle('discord:setBrowsingMods', async () => {
    try {
      await discordRPC.setBrowsingMods();
      return true;
    } catch (error) {
      log.warn('Discord RPC setBrowsingMods failed:', error);
      return false;
    }
  });

  ipcMain.handle('discord:setInSettings', async () => {
    try {
      await discordRPC.setInSettings();
      return true;
    } catch (error) {
      log.warn('Discord RPC setInSettings failed:', error);
      return false;
    }
  });

  log.info('IPC handlers setup complete');
}
