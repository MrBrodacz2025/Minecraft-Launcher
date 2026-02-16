import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import log from 'electron-log';
import Store from 'electron-store';

import { fabricAPI } from '../api/FabricAPI';
import { forgeAPI } from '../api/ForgeAPI';
import { neoForgeAPI } from '../api/NeoForgeAPI';
import { getDefaultGameDirectory, getLauncherDirectory, LOADER_CHECK_INTERVAL_MS } from '../shared/constants';
import type { LoaderVersion, LoaderType, DownloadProgress, Notification } from '../shared/types';

type ProgressCallback = (progress: DownloadProgress) => void;
type NotificationCallback = (notification: Notification) => void;

interface LoaderStore {
  installedLoaders: Record<string, LoaderVersion[]>;
  checkedVersions: Record<string, string[]>; // MC version -> available loaders
  lastCheck: number;
}

export class LoaderManager {
  private store: Store<LoaderStore>;
  private gameDirectory: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private notificationCallback: NotificationCallback | null = null;

  constructor(gameDirectory?: string) {
    this.gameDirectory = gameDirectory || getDefaultGameDirectory();
    this.store = new Store<LoaderStore>({
      name: 'loaders',
      cwd: getLauncherDirectory(),
      defaults: {
        installedLoaders: {},
        checkedVersions: {},
        lastCheck: 0,
      },
    });
  }

  setGameDirectory(directory: string): void {
    this.gameDirectory = directory;
  }

  async getAvailableLoaders(minecraftVersion: string): Promise<LoaderVersion[]> {
    const loaders: LoaderVersion[] = [];

    // Always add vanilla
    loaders.push({
      loader: 'vanilla',
      version: minecraftVersion,
      minecraftVersion,
      stable: true,
    });

    // Check Fabric
    try {
      const fabricVersions = await fabricAPI.getLoaderForGameVersion(minecraftVersion);
      for (const fv of fabricVersions.slice(0, 10)) {
        loaders.push({
          loader: 'fabric',
          version: fv.loader.version,
          minecraftVersion,
          stable: fv.loader.stable,
        });
      }
    } catch (error) {
      log.warn(`No Fabric available for ${minecraftVersion}:`, error);
    }

    // Check Forge
    try {
      const forgeVersions = await forgeAPI.getVersionsForMinecraft(minecraftVersion);
      for (const fv of forgeVersions) {
        loaders.push({
          loader: 'forge',
          version: fv.version,
          minecraftVersion,
          stable: fv.recommended,
        });
      }
    } catch (error) {
      log.warn(`No Forge available for ${minecraftVersion}:`, error);
    }

    // Check NeoForge
    try {
      const neoForgeVersions = await neoForgeAPI.getVersionsForMinecraft(minecraftVersion);
      for (const nfv of neoForgeVersions.slice(0, 5)) {
        loaders.push({
          loader: 'neoforge',
          version: nfv.version,
          minecraftVersion,
          stable: nfv.stable,
        });
      }
    } catch (error) {
      log.warn(`No NeoForge available for ${minecraftVersion}:`, error);
    }

    return loaders;
  }

  async installLoader(
    loader: LoaderType,
    minecraftVersion: string,
    loaderVersion: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    log.info(`Installing ${loader} ${loaderVersion} for Minecraft ${minecraftVersion}`);

    switch (loader) {
      case 'fabric':
        await this.installFabric(minecraftVersion, loaderVersion, onProgress);
        break;
      case 'forge':
        await this.installForge(minecraftVersion, loaderVersion, onProgress);
        break;
      case 'neoforge':
        await this.installNeoForge(minecraftVersion, loaderVersion, onProgress);
        break;
      case 'vanilla':
        // Nothing to install for vanilla
        break;
      default:
        throw new Error(`Unknown loader: ${loader}`);
    }

    // Record installation
    const installedLoaders = this.store.get('installedLoaders');
    if (!installedLoaders[minecraftVersion]) {
      installedLoaders[minecraftVersion] = [];
    }
    installedLoaders[minecraftVersion].push({
      loader,
      version: loaderVersion,
      minecraftVersion,
      stable: true,
    });
    this.store.set('installedLoaders', installedLoaders);
  }

  private async installFabric(
    minecraftVersion: string,
    loaderVersion: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const profile = await fabricAPI.getLoaderProfile(minecraftVersion, loaderVersion);
    
    if (!profile) {
      throw new Error('Failed to get Fabric loader profile');
    }

    const versionId = `fabric-loader-${loaderVersion}-${minecraftVersion}`;
    const versionDir = path.join(this.gameDirectory, 'versions', versionId);
    fs.mkdirSync(versionDir, { recursive: true });

    // Create version JSON
    const versionJson = {
      id: versionId,
      inheritsFrom: minecraftVersion,
      releaseTime: new Date().toISOString(),
      time: new Date().toISOString(),
      type: 'release',
      mainClass: profile.launcherMeta.mainClass.client,
      arguments: {
        game: [],
        jvm: [],
      },
      libraries: [
        ...profile.launcherMeta.libraries.common.map((lib) => ({
          name: lib.name,
          url: lib.url,
        })),
        ...profile.launcherMeta.libraries.client.map((lib) => ({
          name: lib.name,
          url: lib.url,
        })),
      ],
    };

    fs.writeFileSync(
      path.join(versionDir, `${versionId}.json`),
      JSON.stringify(versionJson, null, 2)
    );

    // Download Fabric libraries
    const librariesDir = path.join(this.gameDirectory, 'libraries');
    const allLibraries = [
      ...profile.launcherMeta.libraries.common,
      ...profile.launcherMeta.libraries.client,
    ];

    let downloaded = 0;
    for (const lib of allLibraries) {
      const libPath = this.mavenToPath(lib.name);
      const fullPath = path.join(librariesDir, libPath);
      const url = `${lib.url}${libPath}`;

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      if (!fs.existsSync(fullPath)) {
        onProgress?.({
          type: 'loader',
          name: `Fabric: ${lib.name}`,
          current: downloaded,
          total: allLibraries.length,
          speed: 0,
          percentage: Math.round((downloaded / allLibraries.length) * 100),
        });

        try {
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          fs.writeFileSync(fullPath, response.data);
        } catch (error) {
          log.warn(`Failed to download Fabric library ${lib.name}:`, error);
        }
      }
      downloaded++;
    }

    log.info(`Fabric ${loaderVersion} installed for ${minecraftVersion}`);
  }

  private async installForge(
    minecraftVersion: string,
    forgeVersion: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const installerUrl = forgeAPI.getInstallerUrl(minecraftVersion, forgeVersion);
    const tempDir = path.join(this.gameDirectory, 'temp');
    const installerPath = path.join(tempDir, `forge-${minecraftVersion}-${forgeVersion}-installer.jar`);

    fs.mkdirSync(tempDir, { recursive: true });

    onProgress?.({
      type: 'loader',
      name: `Forge Installer`,
      current: 0,
      total: 100,
      speed: 0,
      percentage: 0,
    });

    // Download installer
    const response = await axios.get(installerUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(installerPath, response.data);

    onProgress?.({
      type: 'loader',
      name: `Forge Installer`,
      current: 50,
      total: 100,
      speed: 0,
      percentage: 50,
    });

    // Extract version JSON from installer
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(installerPath);
    const installProfile = zip.readAsText('install_profile.json');
    const versionJson = zip.readAsText('version.json');

    if (installProfile && versionJson) {
      const versionId = `${minecraftVersion}-forge-${forgeVersion}`;
      const versionDir = path.join(this.gameDirectory, 'versions', versionId);
      fs.mkdirSync(versionDir, { recursive: true });

      const versionData = JSON.parse(versionJson);
      versionData.id = versionId;
      fs.writeFileSync(
        path.join(versionDir, `${versionId}.json`),
        JSON.stringify(versionData, null, 2)
      );

      // Extract libraries from installer
      const profile = JSON.parse(installProfile);
      const librariesDir = path.join(this.gameDirectory, 'libraries');

      for (const lib of profile.libraries || []) {
        if (lib.downloads?.artifact) {
          const artifact = lib.downloads.artifact;
          const libPath = path.join(librariesDir, artifact.path);
          fs.mkdirSync(path.dirname(libPath), { recursive: true });

          try {
            // Try to extract from JAR first
            const jarEntry = zip.getEntry(`maven/${artifact.path}`);
            if (jarEntry) {
              fs.writeFileSync(libPath, jarEntry.getData());
            } else if (artifact.url) {
              // Download from URL
              const libResponse = await axios.get(artifact.url, { responseType: 'arraybuffer' });
              fs.writeFileSync(libPath, libResponse.data);
            }
          } catch (error) {
            log.warn(`Failed to get Forge library ${lib.name}:`, error);
          }
        }
      }
    }

    // Cleanup
    try {
      fs.unlinkSync(installerPath);
      fs.rmdirSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    onProgress?.({
      type: 'loader',
      name: `Forge ${forgeVersion}`,
      current: 100,
      total: 100,
      speed: 0,
      percentage: 100,
    });

    log.info(`Forge ${forgeVersion} installed for ${minecraftVersion}`);
  }

  private async installNeoForge(
    minecraftVersion: string,
    neoForgeVersion: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const installerUrl = neoForgeAPI.getInstallerUrl(neoForgeVersion);
    const tempDir = path.join(this.gameDirectory, 'temp');
    const installerPath = path.join(tempDir, `neoforge-${neoForgeVersion}-installer.jar`);

    fs.mkdirSync(tempDir, { recursive: true });

    onProgress?.({
      type: 'loader',
      name: `NeoForge Installer`,
      current: 0,
      total: 100,
      speed: 0,
      percentage: 0,
    });

    // Download installer
    const response = await axios.get(installerUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(installerPath, response.data);

    onProgress?.({
      type: 'loader',
      name: `NeoForge Installer`,
      current: 50,
      total: 100,
      speed: 0,
      percentage: 50,
    });

    // Extract version JSON (similar to Forge)
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(installerPath);
    const versionJson = zip.readAsText('version.json');

    if (versionJson) {
      const versionId = `${minecraftVersion}-neoforge-${neoForgeVersion}`;
      const versionDir = path.join(this.gameDirectory, 'versions', versionId);
      fs.mkdirSync(versionDir, { recursive: true });

      const versionData = JSON.parse(versionJson);
      versionData.id = versionId;
      fs.writeFileSync(
        path.join(versionDir, `${versionId}.json`),
        JSON.stringify(versionData, null, 2)
      );
    }

    // Cleanup
    try {
      fs.unlinkSync(installerPath);
      fs.rmdirSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    onProgress?.({
      type: 'loader',
      name: `NeoForge ${neoForgeVersion}`,
      current: 100,
      total: 100,
      speed: 0,
      percentage: 100,
    });

    log.info(`NeoForge ${neoForgeVersion} installed for ${minecraftVersion}`);
  }

  async checkForUpdates(): Promise<LoaderVersion[]> {
    const newLoaders: LoaderVersion[] = [];
    const checkedVersions = this.store.get('checkedVersions');
    const installedLoaders = this.store.get('installedLoaders');

    for (const mcVersion of Object.keys(installedLoaders)) {
      const previouslyAvailable = checkedVersions[mcVersion] || [];
      const currentlyAvailable = await this.getAvailableLoaders(mcVersion);

      for (const loader of currentlyAvailable) {
        const key = `${loader.loader}-${loader.version}`;
        if (!previouslyAvailable.includes(key) && loader.loader !== 'vanilla') {
          newLoaders.push(loader);
        }
      }

      // Update checked versions
      checkedVersions[mcVersion] = currentlyAvailable.map(
        (l) => `${l.loader}-${l.version}`
      );
    }

    this.store.set('checkedVersions', checkedVersions);
    this.store.set('lastCheck', Date.now());

    return newLoaders;
  }

  startPeriodicCheck(callback: NotificationCallback): void {
    this.notificationCallback = callback;
    
    this.checkInterval = setInterval(async () => {
      try {
        const newLoaders = await this.checkForUpdates();
        
        if (newLoaders.length > 0 && this.notificationCallback) {
          for (const loader of newLoaders) {
            this.notificationCallback({
              id: `loader-${loader.loader}-${loader.version}`,
              type: 'info',
              title: 'Nowy loader dostępny',
              message: `Dostępny nowy loader ${loader.loader} ${loader.version} dla wersji ${loader.minecraftVersion}`,
              timestamp: Date.now(),
              read: false,
            });
          }
        }
      } catch (error) {
        log.error('Periodic loader check failed:', error);
      }
    }, LOADER_CHECK_INTERVAL_MS);

    log.info('Started periodic loader check');
  }

  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('Stopped periodic loader check');
    }
  }

  getInstalledLoaders(minecraftVersion: string): LoaderVersion[] {
    const installedLoaders = this.store.get('installedLoaders');
    return installedLoaders[minecraftVersion] || [];
  }

  private mavenToPath(maven: string): string {
    const parts = maven.split(':');
    const groupId = parts[0].replace(/\./g, '/');
    const artifactId = parts[1];
    const version = parts[2];
    const classifier = parts[3];

    let filename = `${artifactId}-${version}`;
    if (classifier) {
      filename += `-${classifier}`;
    }
    filename += '.jar';

    return `${groupId}/${artifactId}/${version}/${filename}`;
  }
}
