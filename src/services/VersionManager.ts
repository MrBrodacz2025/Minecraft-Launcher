import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import log from 'electron-log';
import AdmZip from 'adm-zip';

import { minecraftAPI } from '../api/MinecraftAPI';
import { getDefaultGameDirectory, MINECRAFT_RESOURCES_URL, MINECRAFT_LIBRARIES_URL } from '../shared/constants';
import type {
  MinecraftVersion,
  MinecraftVersionDetails,
  DownloadProgress,
  Library,
} from '../shared/types';

type ProgressCallback = (progress: DownloadProgress) => void;

interface AssetObject {
  hash: string;
  size: number;
}

interface AssetIndex {
  objects: Record<string, AssetObject>;
}

export class VersionManager {
  private gameDirectory: string;

  constructor(gameDirectory?: string) {
    this.gameDirectory = gameDirectory || getDefaultGameDirectory();
  }

  setGameDirectory(directory: string): void {
    this.gameDirectory = directory;
  }

  getVersionsDirectory(): string {
    return path.join(this.gameDirectory, 'versions');
  }

  getLibrariesDirectory(): string {
    return path.join(this.gameDirectory, 'libraries');
  }

  getAssetsDirectory(): string {
    return path.join(this.gameDirectory, 'assets');
  }

  async getAllVersions(includeSnapshots = false): Promise<MinecraftVersion[]> {
    return minecraftAPI.getAvailableVersions(includeSnapshots);
  }

  async getVersionDetails(versionId: string): Promise<MinecraftVersionDetails> {
    return minecraftAPI.getVersionDetails(versionId);
  }

  async getInstalledVersions(): Promise<string[]> {
    const versionsDir = this.getVersionsDirectory();
    
    if (!fs.existsSync(versionsDir)) {
      return [];
    }

    const installed: string[] = [];

    try {
      const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const versionJson = path.join(versionsDir, entry.name, `${entry.name}.json`);
          const versionJar = path.join(versionsDir, entry.name, `${entry.name}.jar`);
          
          if (fs.existsSync(versionJson) && fs.existsSync(versionJar)) {
            installed.push(entry.name);
          }
        }
      }
    } catch (error) {
      log.error('Failed to read installed versions:', error);
    }

    return installed;
  }

  async installVersion(versionId: string, onProgress?: ProgressCallback): Promise<void> {
    log.info(`Installing Minecraft ${versionId}...`);

    try {
      // Get version details
      const versionDetails = await this.getVersionDetails(versionId);

      // Create directories
      const versionDir = path.join(this.getVersionsDirectory(), versionId);
      fs.mkdirSync(versionDir, { recursive: true });
      fs.mkdirSync(this.getLibrariesDirectory(), { recursive: true });
      fs.mkdirSync(this.getAssetsDirectory(), { recursive: true });

      // Save version JSON
      const versionJsonPath = path.join(versionDir, `${versionId}.json`);
      fs.writeFileSync(versionJsonPath, JSON.stringify(versionDetails, null, 2));

      // Download client JAR
      await this.downloadClient(versionDetails, versionDir, onProgress);

      // Download libraries
      await this.downloadLibraries(versionDetails, onProgress);

      // Download assets
      await this.downloadAssets(versionDetails, onProgress);

      log.info(`Successfully installed Minecraft ${versionId}`);
    } catch (error) {
      log.error(`Failed to install version ${versionId}:`, error);
      throw error;
    }
  }

  private async downloadClient(
    versionDetails: MinecraftVersionDetails,
    versionDir: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const clientDownload = versionDetails.downloads.client;
    const clientPath = path.join(versionDir, `${versionDetails.id}.jar`);

    if (fs.existsSync(clientPath)) {
      const hash = await this.calculateFileHash(clientPath);
      if (hash === clientDownload.sha1) {
        log.info('Client JAR already exists and is valid');
        return;
      }
    }

    onProgress?.({
      type: 'version',
      name: `Minecraft ${versionDetails.id}`,
      current: 0,
      total: clientDownload.size,
      speed: 0,
      percentage: 0,
    });

    await this.downloadFile(clientDownload.url, clientPath, (downloaded, total, speed) => {
      onProgress?.({
        type: 'version',
        name: `Minecraft ${versionDetails.id}`,
        current: downloaded,
        total,
        speed,
        percentage: Math.round((downloaded / total) * 100),
      });
    });
  }

  private async downloadLibraries(
    versionDetails: MinecraftVersionDetails,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const libraries = versionDetails.libraries.filter((lib) => this.shouldDownloadLibrary(lib));
    const totalLibraries = libraries.length;
    let downloadedCount = 0;

    for (const library of libraries) {
      const artifact = library.downloads?.artifact;
      if (!artifact) continue;

      const libPath = path.join(this.getLibrariesDirectory(), artifact.path);
      const libDir = path.dirname(libPath);
      fs.mkdirSync(libDir, { recursive: true });

      if (fs.existsSync(libPath)) {
        const hash = await this.calculateFileHash(libPath);
        if (hash === artifact.sha1) {
          downloadedCount++;
          continue;
        }
      }

      onProgress?.({
        type: 'libraries',
        name: library.name,
        current: downloadedCount,
        total: totalLibraries,
        speed: 0,
        percentage: Math.round((downloadedCount / totalLibraries) * 100),
      });

      try {
        const url = artifact.url || `${MINECRAFT_LIBRARIES_URL}/${artifact.path}`;
        await this.downloadFile(url, libPath);
        downloadedCount++;
      } catch (error) {
        log.warn(`Failed to download library ${library.name}:`, error);
      }
    }

    // Handle native libraries
    await this.extractNatives(versionDetails);
  }

  private async extractNatives(versionDetails: MinecraftVersionDetails): Promise<void> {
    const platform = this.getPlatform();
    const nativesDir = path.join(this.getVersionsDirectory(), versionDetails.id, 'natives');
    fs.mkdirSync(nativesDir, { recursive: true });

    // Map platform to native suffix patterns
    const nativeSuffixes: Record<string, string[]> = {
      'windows': ['natives-windows', 'natives-windows-x86_64'],
      'osx': ['natives-macos', 'natives-macos-arm64', 'natives-macos-patch'],
      'linux': ['natives-linux', 'natives-linux-arm64'],
    };
    const currentSuffixes = nativeSuffixes[platform] || [];

    for (const library of versionDetails.libraries) {
      let nativePath: string | null = null;

      // NEW FORMAT: Check if library name contains natives suffix (MC 1.19+)
      const libName = library.name.toLowerCase();
      const isNativeLib = currentSuffixes.some(suffix => libName.includes(`:${suffix}`));
      
      if (isNativeLib && library.downloads?.artifact) {
        // Check rules to see if this library applies to current OS
        if (library.rules) {
          const allowed = this.checkRules(library.rules);
          if (!allowed) continue;
        }
        nativePath = path.join(this.getLibrariesDirectory(), library.downloads.artifact.path);
      }
      // OLD FORMAT: Check for natives map and classifiers (MC < 1.19)
      else if (library.natives && library.downloads?.classifiers) {
        const nativeKey = library.natives[platform];
        if (!nativeKey) continue;
        
        const classifier = library.downloads.classifiers[nativeKey];
        if (!classifier) continue;
        
        nativePath = path.join(this.getLibrariesDirectory(), classifier.path);
      }

      if (!nativePath || !fs.existsSync(nativePath)) continue;

      try {
        const zip = new AdmZip(nativePath);
        const entries = zip.getEntries();

        for (const entry of entries) {
          // Skip META-INF
          if (entry.entryName.startsWith('META-INF/')) continue;
          
          // Skip excluded files
          if (library.extract?.exclude?.some((ex) => entry.entryName.startsWith(ex))) {
            continue;
          }

          const extractPath = path.join(nativesDir, entry.entryName);
          if (!entry.isDirectory) {
            fs.mkdirSync(path.dirname(extractPath), { recursive: true });
            fs.writeFileSync(extractPath, entry.getData());
          }
        }
        log.info(`Extracted natives from ${path.basename(nativePath)}`);
      } catch (error) {
        log.warn(`Failed to extract natives from ${nativePath}:`, error);
      }
    }
  }

  private checkRules(rules: Array<{ action: string; os?: { name?: string } }>): boolean {
    const platform = this.getPlatform();
    const osNameMap: Record<string, string> = {
      'windows': 'windows',
      'osx': 'osx',
      'linux': 'linux',
    };
    const currentOsName = osNameMap[platform];

    let allowed = false;
    for (const rule of rules) {
      if (rule.action === 'allow') {
        if (!rule.os) {
          // No OS specified means allow all
          allowed = true;
        } else if (rule.os.name === currentOsName) {
          allowed = true;
        }
      } else if (rule.action === 'disallow') {
        if (!rule.os || rule.os.name === currentOsName) {
          allowed = false;
        }
      }
    }
    return allowed;
  }

  private async downloadAssets(
    versionDetails: MinecraftVersionDetails,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const assetIndex = versionDetails.assetIndex;
    const indexDir = path.join(this.getAssetsDirectory(), 'indexes');
    const indexPath = path.join(indexDir, `${assetIndex.id}.json`);
    fs.mkdirSync(indexDir, { recursive: true });

    // Download asset index
    let assetIndexData: AssetIndex;
    if (fs.existsSync(indexPath)) {
      const hash = await this.calculateFileHash(indexPath);
      if (hash === assetIndex.sha1) {
        assetIndexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } else {
        const response = await axios.get<AssetIndex>(assetIndex.url);
        assetIndexData = response.data;
        fs.writeFileSync(indexPath, JSON.stringify(assetIndexData, null, 2));
      }
    } else {
      const response = await axios.get<AssetIndex>(assetIndex.url);
      assetIndexData = response.data;
      fs.writeFileSync(indexPath, JSON.stringify(assetIndexData, null, 2));
    }

    // Download assets
    const objects = Object.entries(assetIndexData.objects);
    const totalAssets = objects.length;
    let downloadedCount = 0;

    const objectsDir = path.join(this.getAssetsDirectory(), 'objects');
    fs.mkdirSync(objectsDir, { recursive: true });

    for (const [, asset] of objects) {
      const hashPrefix = asset.hash.substring(0, 2);
      const assetDir = path.join(objectsDir, hashPrefix);
      const assetPath = path.join(assetDir, asset.hash);

      if (fs.existsSync(assetPath)) {
        const hash = await this.calculateFileHash(assetPath);
        if (hash === asset.hash) {
          downloadedCount++;
          continue;
        }
      }

      fs.mkdirSync(assetDir, { recursive: true });

      onProgress?.({
        type: 'assets',
        name: 'Assets',
        current: downloadedCount,
        total: totalAssets,
        speed: 0,
        percentage: Math.round((downloadedCount / totalAssets) * 100),
      });

      try {
        const url = `${MINECRAFT_RESOURCES_URL}/${hashPrefix}/${asset.hash}`;
        await this.downloadFile(url, assetPath);
        downloadedCount++;
      } catch (error) {
        log.warn(`Failed to download asset ${asset.hash}:`, error);
      }
    }
  }

  async verifyVersion(versionId: string): Promise<boolean> {
    try {
      const versionDir = path.join(this.getVersionsDirectory(), versionId);
      const versionJsonPath = path.join(versionDir, `${versionId}.json`);
      const versionJarPath = path.join(versionDir, `${versionId}.jar`);

      if (!fs.existsSync(versionJsonPath) || !fs.existsSync(versionJarPath)) {
        return false;
      }

      const versionDetails: MinecraftVersionDetails = JSON.parse(
        fs.readFileSync(versionJsonPath, 'utf8')
      );

      // Verify client JAR
      const clientHash = await this.calculateFileHash(versionJarPath);
      if (clientHash !== versionDetails.downloads.client.sha1) {
        log.warn(`Client JAR hash mismatch for ${versionId}`);
        return false;
      }

      // Verify critical libraries
      for (const library of versionDetails.libraries) {
        if (!this.shouldDownloadLibrary(library)) continue;

        const artifact = library.downloads?.artifact;
        if (!artifact) continue;

        const libPath = path.join(this.getLibrariesDirectory(), artifact.path);
        if (!fs.existsSync(libPath)) {
          log.warn(`Missing library: ${library.name}`);
          return false;
        }

        const hash = await this.calculateFileHash(libPath);
        if (hash !== artifact.sha1) {
          log.warn(`Library hash mismatch: ${library.name}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      log.error(`Failed to verify version ${versionId}:`, error);
      return false;
    }
  }

  private shouldDownloadLibrary(library: Library): boolean {
    if (!library.rules) return true;

    const platform = this.getPlatform();
    let allowed = false;

    for (const rule of library.rules) {
      if (rule.os) {
        if (rule.os.name && rule.os.name !== platform) continue;
      }

      allowed = rule.action === 'allow';
    }

    return allowed;
  }

  private getPlatform(): string {
    const platform = process.platform;
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'osx';
    return 'linux';
  }

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (downloaded: number, total: number, speed: number) => void
  ): Promise<void> {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 30000,
    });

    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedSize = 0;
    let lastTime = Date.now();
    let lastDownloaded = 0;

    const writer = fs.createWriteStream(destPath);

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        
        const now = Date.now();
        const elapsed = now - lastTime;
        
        if (elapsed >= 100) {
          const speed = ((downloadedSize - lastDownloaded) / elapsed) * 1000;
          onProgress?.(downloadedSize, totalSize, speed);
          lastTime = now;
          lastDownloaded = downloadedSize;
        }
      });

      response.data.pipe(writer);

      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
