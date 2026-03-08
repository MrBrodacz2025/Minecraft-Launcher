import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron';
import log from 'electron-log';

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

  ipcMain.handle(IPC_CHANNELS.VERSIONS_GET_DETAILS, async (_event, versionId: string) => {
    try {
      return await versionManager.getVersionDetails(versionId);
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

  ipcMain.handle(IPC_CHANNELS.VERSIONS_INSTALL, async (_event, versionId: string) => {
    try {
      log.info(`Versions: Installing version ${versionId}`);
      await versionManager.installVersion(versionId, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Versions: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERSIONS_VERIFY, async (_event, versionId: string) => {
    try {
      return await versionManager.verifyVersion(versionId);
    } catch (error) {
      log.error('Versions: Verify failed', error);
      throw error;
    }
  });

  // ==================== LOADERS ====================
  ipcMain.handle(IPC_CHANNELS.LOADERS_GET_AVAILABLE, async (_event, minecraftVersion: string) => {
    try {
      return await loaderManager.getAvailableLoaders(minecraftVersion);
    } catch (error) {
      log.error('Loaders: Get available failed', error);
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.LOADERS_INSTALL,
    async (_event, loader: LoaderType, minecraftVersion: string, loaderVersion: string) => {
      try {
        log.info(`Loaders: Installing ${loader} ${loaderVersion} for MC ${minecraftVersion}`);
        await loaderManager.installLoader(loader, minecraftVersion, loaderVersion, (progress) => {
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
  ipcMain.handle(IPC_CHANNELS.MODS_SEARCH, async (_event, query: string, filters: ModSearchFilters) => {
    try {
      return await modManager.searchMods(query, filters);
    } catch (error) {
      log.error('Mods: Search failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_INSTALL, async (_event, mod: Mod, version: ModVersion, gameVersion?: string) => {
    try {
      log.info(`Mods: Installing ${mod.name} version ${version.versionNumber} for MC ${gameVersion || 'auto'}`);
      await modManager.installMod(mod, version, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      }, gameVersion);
    } catch (error) {
      log.error('Mods: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_UNINSTALL, async (_event, modId: string) => {
    try {
      log.info(`Mods: Uninstalling mod ${modId}`);
      await modManager.uninstallMod(modId);
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

  ipcMain.handle(IPC_CHANNELS.MODS_GET_DEPENDENCIES, async (_event, modVersion: ModVersion) => {
    try {
      return await modManager.getDependencies(modVersion);
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

  ipcMain.handle(IPC_CHANNELS.MODS_ORGANIZE, async (_event, version: string) => {
    try {
      await modManager.organizeMods(version);
    } catch (error) {
      log.error('Mods: Organize failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODS_ACTIVATE_VERSION, async (_event, version: string) => {
    try {
      await modManager.activateModsForVersion(version);
    } catch (error) {
      log.error('Mods: Activate version failed', error);
      throw error;
    }
  });

  // ==================== MODPACKS ====================
  ipcMain.handle(IPC_CHANNELS.MODPACKS_SEARCH, async (_event, query: string, filters: ModpackSearchFilters) => {
    try {
      return await modpackManager.searchModpacks(query, filters);
    } catch (error) {
      log.error('Modpacks: Search failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_GET_DETAILS, async (_event, modpackId: string, source: 'curseforge' | 'modrinth') => {
    try {
      return await modpackManager.getModpackDetails(modpackId, source);
    } catch (error) {
      log.error('Modpacks: Get details failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_GET_FILES, async (_event, modpackId: string, source: 'curseforge' | 'modrinth', gameVersion?: string) => {
    try {
      return await modpackManager.getModpackFiles(modpackId, source, gameVersion);
    } catch (error) {
      log.error('Modpacks: Get files failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_INSTALL, async (_event, modpack: Modpack, file: ModpackFile) => {
    try {
      log.info(`Modpacks: Installing ${modpack.name}`);
      await modpackManager.installModpack(modpack, file, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Modpacks: Install failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_UNINSTALL, async (_event, modpackId: string) => {
    try {
      log.info(`Modpacks: Uninstalling modpack ${modpackId}`);
      await modpackManager.uninstallModpack(modpackId);
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

  ipcMain.handle(IPC_CHANNELS.MODPACKS_UPDATE, async (_event, modpackId: string) => {
    try {
      log.info(`Modpacks: Updating modpack ${modpackId}`);
      await modpackManager.updateModpack(modpackId, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
      });
    } catch (error) {
      log.error('Modpacks: Update failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MODPACKS_SET_AUTO_UPDATE, async (_event, modpackId: string, enabled: boolean) => {
    try {
      await modpackManager.setAutoUpdate(modpackId, enabled);
    } catch (error) {
      log.error('Modpacks: Set auto update failed', error);
      throw error;
    }
  });

  // ==================== LAUNCHER ====================
  ipcMain.handle(IPC_CHANNELS.LAUNCHER_LAUNCH, async (_event, config: LaunchConfig) => {
    try {
      log.info(`Launcher: Launching Minecraft ${config.version}`);
      await launcherService.launch(config);
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings: Partial<LauncherSettings>) => {
    try {
      await settingsService.setSettings(settings);
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

  ipcMain.handle(IPC_CHANNELS.JAVA_GET_REQUIRED, async (_event, mcVersion: string) => {
    try {
      const { javaService } = await import('../services/JavaService');
      return javaService.getRequiredJavaVersion(mcVersion);
    } catch (error) {
      log.error('Java: Get required failed', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JAVA_DOWNLOAD, async (_event, version: number) => {
    try {
      const { javaService } = await import('../services/JavaService');
      return await javaService.downloadJava(version, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
          type: 'java',
          filename: `Java ${version}`,
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

  ipcMain.handle(IPC_CHANNELS.JAVA_ENSURE, async (_event, mcVersion: string) => {
    try {
      const { javaService } = await import('../services/JavaService');
      return await javaService.ensureJavaForMinecraft(mcVersion, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
          type: 'java',
          filename: `Java dla MC ${mcVersion}`,
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
    await shell.openExternal(url);
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
