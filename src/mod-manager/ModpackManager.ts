import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import log from 'electron-log';
import Store from 'electron-store';

import { curseForgeAPI } from '../api/CurseForgeAPI';
import { SettingsService } from '../services/SettingsService';
import { getLauncherDirectory } from '../shared/constants';
import type {
  Modpack,
  ModpackFile,
  InstalledModpack,
  ModpackSearchFilters,
  DownloadProgress,
  LoaderType,
} from '../shared/types';

type ProgressCallback = (progress: DownloadProgress) => void;

interface ModpackStore {
  installedModpacks: InstalledModpack[];
}

export class ModpackManager {
  private store: Store<ModpackStore>;
  private settingsService: SettingsService;
  private searchCache = new Map<string, { results: Modpack[]; timestamp: number }>();
  private readonly CACHE_TTL = 60000;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.store = new Store<ModpackStore>({
      name: 'modpacks',
      cwd: getLauncherDirectory(),
      defaults: {
        installedModpacks: [],
      },
    });
  }

  async searchModpacks(query: string, filters: ModpackSearchFilters): Promise<Modpack[]> {
    const cacheKey = JSON.stringify({ query, filters });
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }

    const results: Modpack[] = [];

    try {
      if (!filters.source || filters.source === 'all' || filters.source === 'curseforge') {
        const cfResults = await curseForgeAPI.searchModpacks(query, filters).catch(err => {
          log.warn('CurseForge modpack search failed:', err);
          return [];
        });
        results.push(...cfResults);
      }

      const sortedResults = results.sort((a, b) => b.downloads - a.downloads);

      this.searchCache.set(cacheKey, { results: sortedResults, timestamp: Date.now() });

      if (this.searchCache.size > 50) {
        const oldestKey = this.searchCache.keys().next().value;
        if (oldestKey) this.searchCache.delete(oldestKey);
      }

      return sortedResults;
    } catch (error) {
      log.error('Modpack search failed:', error);
      throw error;
    }
  }

  async getModpackDetails(modpackId: string, source: 'curseforge' | 'modrinth'): Promise<Modpack | null> {
    try {
      if (source === 'curseforge') {
        return await curseForgeAPI.getModpack(parseInt(modpackId));
      }
      return null;
    } catch (error) {
      log.error(`Failed to get modpack details ${modpackId}:`, error);
      return null;
    }
  }

  async getModpackFiles(modpackId: string, source: 'curseforge' | 'modrinth', gameVersion?: string): Promise<ModpackFile[]> {
    try {
      if (source === 'curseforge') {
        return await curseForgeAPI.getModpackFiles(parseInt(modpackId), gameVersion);
      }
      return [];
    } catch (error) {
      log.error(`Failed to get modpack files ${modpackId}:`, error);
      return [];
    }
  }

  async installModpack(
    modpack: Modpack,
    file: ModpackFile,
    onProgress?: ProgressCallback
  ): Promise<void> {
    log.info(`Installing modpack: ${modpack.name} - ${file.versionNumber}`);

    const gameDirectory = this.settingsService.getGameDirectory();
    const modpacksDir = path.join(gameDirectory, 'modpacks');
    const modpackDir = path.join(modpacksDir, modpack.slug);

    fs.mkdirSync(modpackDir, { recursive: true });

    const zipPath = path.join(modpackDir, file.fileName);

    onProgress?.({
      type: 'mod',
      name: modpack.name,
      current: 0,
      total: file.fileSize,
      speed: 0,
      percentage: 0,
    });

    try {
      let downloadUrl = file.downloadUrl;

      if (modpack.source === 'curseforge' && !downloadUrl) {
        downloadUrl = await curseForgeAPI.getFileDownloadUrl(
          parseInt(modpack.id),
          parseInt(file.id)
        ) || '';
      }

      if (!downloadUrl) {
        throw new Error('No download URL available for this modpack');
      }

      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 120000,
      });

      const totalSize = parseInt(response.headers['content-length'] || file.fileSize.toString(), 10);
      let downloadedSize = 0;
      let lastTime = Date.now();
      let lastDownloaded = 0;

      const writer = fs.createWriteStream(zipPath);

      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        const now = Date.now();
        const elapsed = now - lastTime;

        if (elapsed >= 100) {
          const speed = ((downloadedSize - lastDownloaded) / elapsed) * 1000;
          onProgress?.({
            type: 'mod',
            name: modpack.name,
            current: downloadedSize,
            total: totalSize,
            speed,
            percentage: Math.round((downloadedSize / totalSize) * 100),
          });
          lastTime = now;
          lastDownloaded = downloadedSize;
        }
      });

      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      // Extract modpack if it's a zip
      if (file.fileName.endsWith('.zip')) {
        onProgress?.({
          type: 'mod',
          name: `${modpack.name} - Rozpakowywanie...`,
          percentage: 95,
        });

        try {
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(modpackDir, true);
        } catch (extractError) {
          log.warn('Failed to extract modpack zip, keeping as-is:', extractError);
        }
      }

      // Process overrides (CurseForge modpack format)
      const overridesDir = path.join(modpackDir, 'overrides');
      if (fs.existsSync(overridesDir)) {
        this.copyOverrides(overridesDir, modpackDir);
      }

      // Process manifest.json for CurseForge modpacks
      const manifestPath = path.join(modpackDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        await this.processManifest(manifestPath, modpackDir, onProgress);
      }

      const gameVersion = file.gameVersions[0] || 'unknown';
      const loader = file.loaders[0] || 'forge';

      const installedModpack: InstalledModpack = {
        id: modpack.id,
        name: modpack.name,
        version: file.versionNumber,
        fileId: file.id,
        source: modpack.source,
        loader,
        gameVersion,
        installedAt: new Date().toISOString(),
        installPath: modpackDir,
        autoUpdate: true,
      };

      const installedModpacks = this.store.get('installedModpacks');
      const existingIndex = installedModpacks.findIndex((m) => m.id === modpack.id);

      if (existingIndex >= 0) {
        installedModpacks[existingIndex] = installedModpack;
      } else {
        installedModpacks.push(installedModpack);
      }

      this.store.set('installedModpacks', installedModpacks);

      onProgress?.({
        type: 'mod',
        name: modpack.name,
        percentage: 100,
      });

      log.info(`Successfully installed modpack ${modpack.name}`);
    } catch (error) {
      log.error(`Failed to install modpack ${modpack.name}:`, error);

      // Cleanup on failure
      if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
      }

      throw error;
    }
  }

  private copyOverrides(overridesDir: string, targetDir: string): void {
    const entries = fs.readdirSync(overridesDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(overridesDir, entry.name);
      const destPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyOverrides(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private async processManifest(
    manifestPath: string,
    modpackDir: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      if (!manifest.files || !Array.isArray(manifest.files)) return;

      const modsDir = path.join(modpackDir, 'mods');
      fs.mkdirSync(modsDir, { recursive: true });

      const totalFiles = manifest.files.length;
      let completedFiles = 0;

      for (const file of manifest.files) {
        try {
          const downloadUrl = await curseForgeAPI.getFileDownloadUrl(file.projectID, file.fileID);
          if (!downloadUrl) continue;

          // Get file info
          const fileResponse = await axios.head(downloadUrl, { timeout: 10000 }).catch(() => null);
          const fileName = downloadUrl.split('/').pop() || `mod_${file.fileID}.jar`;
          const filePath = path.join(modsDir, fileName);

          const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 60000,
          });

          fs.writeFileSync(filePath, response.data);

          completedFiles++;
          onProgress?.({
            type: 'mod',
            name: `${fileName} (${completedFiles}/${totalFiles})`,
            current: completedFiles,
            total: totalFiles,
            percentage: Math.round((completedFiles / totalFiles) * 90) + 5,
          });
        } catch (err) {
          log.warn(`Failed to download modpack file ${file.projectID}/${file.fileID}:`, err);
          completedFiles++;
        }
      }
    } catch (error) {
      log.error('Failed to process modpack manifest:', error);
    }
  }

  async uninstallModpack(modpackId: string): Promise<void> {
    log.info(`Uninstalling modpack: ${modpackId}`);

    const installedModpacks = this.store.get('installedModpacks');
    const modpackIndex = installedModpacks.findIndex((m) => m.id === modpackId);

    if (modpackIndex < 0) {
      throw new Error('Modpack not found');
    }

    const modpack = installedModpacks[modpackIndex];

    if (fs.existsSync(modpack.installPath)) {
      fs.rmSync(modpack.installPath, { recursive: true, force: true });
    }

    installedModpacks.splice(modpackIndex, 1);
    this.store.set('installedModpacks', installedModpacks);

    log.info(`Successfully uninstalled modpack ${modpack.name}`);
  }

  async getInstalledModpacks(): Promise<InstalledModpack[]> {
    const installedModpacks = this.store.get('installedModpacks');

    const validModpacks = installedModpacks.filter((modpack) => {
      if (!fs.existsSync(modpack.installPath)) {
        log.warn(`Modpack directory missing: ${modpack.installPath}`);
        return false;
      }
      return true;
    });

    if (validModpacks.length !== installedModpacks.length) {
      this.store.set('installedModpacks', validModpacks);
    }

    return validModpacks;
  }

  async checkForUpdates(): Promise<InstalledModpack[]> {
    const installedModpacks = await this.getInstalledModpacks();
    const updatable: InstalledModpack[] = [];

    for (const modpack of installedModpacks) {
      if (!modpack.autoUpdate) continue;

      try {
        let files: ModpackFile[] = [];
        if (modpack.source === 'curseforge') {
          files = await curseForgeAPI.getModpackFiles(parseInt(modpack.id), modpack.gameVersion);
        }

        if (files.length > 0) {
          const latestFile = files[0];
          if (latestFile.id !== modpack.fileId) {
            modpack.latestVersion = latestFile.versionNumber;
            modpack.updateAvailable = true;
            updatable.push(modpack);
          }
        }
      } catch (error) {
        log.warn(`Failed to check updates for modpack ${modpack.name}:`, error);
      }
    }

    // Update store with latest version info
    if (updatable.length > 0) {
      this.store.set('installedModpacks', installedModpacks);
    }

    return updatable;
  }

  async updateModpack(modpackId: string, onProgress?: ProgressCallback): Promise<void> {
    const installedModpacks = this.store.get('installedModpacks');
    const modpack = installedModpacks.find((m) => m.id === modpackId);

    if (!modpack) {
      throw new Error('Modpack not found');
    }

    let modpackDetails: Modpack | null = null;
    let files: ModpackFile[] = [];

    if (modpack.source === 'curseforge') {
      modpackDetails = await curseForgeAPI.getModpack(parseInt(modpackId));
      files = await curseForgeAPI.getModpackFiles(parseInt(modpackId), modpack.gameVersion);
    }

    if (!modpackDetails || files.length === 0) {
      throw new Error('No update available');
    }

    const latestFile = files[0];

    // Reinstall with latest version
    await this.installModpack(modpackDetails, latestFile, onProgress);

    log.info(`Successfully updated modpack ${modpack.name} to ${latestFile.versionNumber}`);
  }

  async setAutoUpdate(modpackId: string, enabled: boolean): Promise<void> {
    const installedModpacks = this.store.get('installedModpacks');
    const modpack = installedModpacks.find((m) => m.id === modpackId);

    if (!modpack) {
      throw new Error('Modpack not found');
    }

    modpack.autoUpdate = enabled;
    this.store.set('installedModpacks', installedModpacks);
  }
}
