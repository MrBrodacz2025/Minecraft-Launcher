import { AppUpdater, UpdateCheckResult, UpdateInfo as ElectronUpdateInfo } from 'electron-updater';
import log from 'electron-log';

import type { UpdateInfo } from '../shared/types';

export class UpdaterService {
  private autoUpdater: AppUpdater | null = null;
  private updateAvailable: UpdateInfo | null = null;
  private downloadProgress: number = 0;
  private isDownloading: boolean = false;

  constructor(autoUpdater?: AppUpdater) {
    if (autoUpdater) {
      this.autoUpdater = autoUpdater;
      this.setupAutoUpdater();
    }
  }

  private setupAutoUpdater(): void {
    if (!this.autoUpdater) return;

    this.autoUpdater.logger = log;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = true;

    this.autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });

    this.autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      log.info('Update available:', info.version);
      this.updateAvailable = {
        version: info.version,
        releaseDate: info.releaseDate || new Date().toISOString(),
        releaseNotes: typeof info.releaseNotes === 'string' 
          ? info.releaseNotes 
          : '',
        downloadUrl: '',
        mandatory: false,
      };
    });

    this.autoUpdater.on('update-not-available', () => {
      log.info('No updates available');
      this.updateAvailable = null;
    });

    this.autoUpdater.on('download-progress', (progress) => {
      this.downloadProgress = progress.percent;
      log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    });

    this.autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      log.info('Update downloaded:', info.version);
      this.isDownloading = false;
    });

    this.autoUpdater.on('error', (error) => {
      log.error('Auto updater error:', error);
      this.isDownloading = false;
    });
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      if (this.autoUpdater) {
        const result: UpdateCheckResult | null = await this.autoUpdater.checkForUpdates();
        
        if (result && result.updateInfo) {
          return {
            version: result.updateInfo.version,
            releaseDate: result.updateInfo.releaseDate || new Date().toISOString(),
            releaseNotes: typeof result.updateInfo.releaseNotes === 'string'
              ? result.updateInfo.releaseNotes
              : '',
            downloadUrl: '',
            mandatory: false,
          };
        }
      }

      return null;
    } catch (error) {
      log.error('Failed to check for updates:', error);
      return null;
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!this.autoUpdater) {
      throw new Error('Auto updater not initialized');
    }

    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    this.isDownloading = true;
    this.downloadProgress = 0;

    try {
      await this.autoUpdater.downloadUpdate();
    } catch (error) {
      this.isDownloading = false;
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  installUpdate(): void {
    if (!this.autoUpdater) {
      throw new Error('Auto updater not initialized');
    }

    log.info('Installing update and restarting...');
    this.autoUpdater.quitAndInstall(false, true);
  }

  getUpdateInfo(): UpdateInfo | null {
    return this.updateAvailable;
  }

  getDownloadProgress(): number {
    return this.downloadProgress;
  }

  isUpdateDownloading(): boolean {
    return this.isDownloading;
  }
}
