import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

import { setupIpcHandlers } from './ipc';
import { UpdaterService } from '../updater/UpdaterService';
import { LoaderManager } from '../loader-manager/LoaderManager';
import { getLauncherDirectory } from '../shared/constants';
import { discordRPC } from '../services/DiscordRPCService';

// Configure logging
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
log.catchErrors();

let mainWindow: BrowserWindow | null = null;
let loaderManager: LoaderManager | null = null;
let updaterService: UpdaterService | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0F0F0F',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0F0F0F',
      symbolColor: '#FFFFFF',
      height: 40,
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Setup IPC handlers
  setupIpcHandlers(mainWindow);

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:3000');
  } else {
    const htmlPath = path.join(__dirname, '../../renderer/index.html');
    log.info('Loading HTML from:', htmlPath);
    await mainWindow.loadFile(htmlPath);
  }

  // Log any renderer errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log.info('Renderer console:', message);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Initialize services
  await initializeServices();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created successfully');
}

async function initializeServices(): Promise<void> {
  try {
    // Initialize LoaderManager for periodic updates
    loaderManager = new LoaderManager();
    
    // Start periodic loader checks
    loaderManager.startPeriodicCheck((notification) => {
      if (mainWindow) {
        mainWindow.webContents.send('notification', notification);
      }
    });

    // Initialize UpdaterService
    updaterService = new UpdaterService(autoUpdater);
    
    if (!isDev) {
      await updaterService.checkForUpdates();
    }

    // Initialize Discord RPC
    try {
      await discordRPC.connect();
      log.info('Discord RPC initialized');
    } catch (error) {
      log.warn('Discord RPC failed to connect (Discord may not be running):', error);
    }

    log.info('Services initialized successfully');
  } catch (error) {
    log.error('Failed to initialize services:', error);
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Ensure launcher directory exists
    const fs = await import('fs');
    const launcherDir = getLauncherDirectory();
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
    }

    await createWindow();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });
  });

  app.on('window-all-closed', async () => {
    if (loaderManager) {
      loaderManager.stopPeriodicCheck();
    }
    // Disconnect Discord RPC
    try {
      await discordRPC.disconnect();
    } catch (error) {
      log.warn('Error disconnecting Discord RPC:', error);
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error);
  });

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:', reason);
  });
}

export { mainWindow };
