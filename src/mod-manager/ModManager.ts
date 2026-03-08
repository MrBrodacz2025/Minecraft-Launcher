import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import log from 'electron-log';
import Store from 'electron-store';

import { curseForgeAPI } from '../api/CurseForgeAPI';
import { modrinthAPI } from '../api/ModrinthAPI';
import { SettingsService } from '../services/SettingsService';
import { getLauncherDirectory } from '../shared/constants';
import type {
  Mod,
  ModVersion,
  ModDependency,
  InstalledMod,
  ModConflict,
  ModSearchFilters,
  DownloadProgress,
  LoaderType,
} from '../shared/types';

type ProgressCallback = (progress: DownloadProgress) => void;

interface ModStore {
  installedMods: InstalledMod[];
}

export class ModManager {
  private store: Store<ModStore>;
  private settingsService: SettingsService;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
    this.store = new Store<ModStore>({
      name: 'mods',
      cwd: getLauncherDirectory(),
      defaults: {
        installedMods: [],
      },
    });
  }

  // Simple cache for search results
  private searchCache = new Map<string, { results: Mod[]; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  async searchMods(query: string, filters: ModSearchFilters): Promise<Mod[]> {
    // Create cache key
    const cacheKey = JSON.stringify({ query, filters });
    const cached = this.searchCache.get(cacheKey);
    
    // Return cached results if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      log.info('Returning cached search results for:', query);
      return cached.results;
    }

    const results: Mod[] = [];
    const searchPromises: Promise<Mod[]>[] = [];

    try {
      // Search in PARALLEL for better performance
      if (!filters.source || filters.source === 'all' || filters.source === 'curseforge') {
        searchPromises.push(
          curseForgeAPI.searchMods(query, filters).catch(err => {
            log.warn('CurseForge search failed:', err);
            return [];
          })
        );
      }

      if (!filters.source || filters.source === 'all' || filters.source === 'modrinth') {
        searchPromises.push(
          modrinthAPI.searchMods(query, filters).catch(err => {
            log.warn('Modrinth search failed:', err);
            return [];
          })
        );
      }

      // Wait for all searches to complete in parallel
      const allResults = await Promise.all(searchPromises);
      for (const sourceResults of allResults) {
        results.push(...sourceResults);
      }

      // Remove duplicates (same mod name from different sources)
      const seen = new Map<string, Mod>();
      for (const mod of results) {
        const key = mod.slug.toLowerCase();
        const existing = seen.get(key);
        
        if (!existing || mod.downloads > existing.downloads) {
          seen.set(key, mod);
        }
      }

      // Sort by downloads
      const sortedResults = Array.from(seen.values()).sort((a, b) => b.downloads - a.downloads);
      
      // Cache results
      this.searchCache.set(cacheKey, { results: sortedResults, timestamp: Date.now() });
      
      // Clean old cache entries (keep max 50)
      if (this.searchCache.size > 50) {
        const oldestKey = this.searchCache.keys().next().value;
        if (oldestKey) this.searchCache.delete(oldestKey);
      }
      
      return sortedResults;
    } catch (error) {
      log.error('Mod search failed:', error);
      throw error;
    }
  }

  async installMod(
    mod: Mod,
    version: ModVersion,
    onProgress?: ProgressCallback,
    targetGameVersion?: string
  ): Promise<void> {
    log.info(`Installing mod: ${mod.name} v${version.versionNumber}`);

    const gameDirectory = this.settingsService.getGameDirectory();
    
    // Determine game version - use provided target or first compatible version
    const gameVersion = targetGameVersion || version.gameVersions[0] || 'unknown';
    
    // Create version-specific mods directory
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const versionModsDir = path.join(modsBaseDir, gameVersion);
    
    // Also keep traditional mods folder for compatibility
    fs.mkdirSync(modsBaseDir, { recursive: true });
    fs.mkdirSync(versionModsDir, { recursive: true });

    const modPath = path.join(versionModsDir, version.fileName);
    
    log.info(`Installing mod to version folder: ${versionModsDir}`);

    // Download mod file
    onProgress?.({
      type: 'mod',
      name: mod.name,
      current: 0,
      total: version.fileSize,
      speed: 0,
      percentage: 0,
    });

    try {
      let downloadUrl = version.downloadUrl;

      // For CurseForge, we might need to get the download URL
      if (mod.source === 'curseforge' && !downloadUrl) {
        downloadUrl = await curseForgeAPI.getFileDownloadUrl(
          parseInt(mod.id),
          parseInt(version.id)
        ) || '';
      }

      if (!downloadUrl) {
        throw new Error('No download URL available for this mod');
      }

      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 60000,
      });

      const totalSize = parseInt(response.headers['content-length'] || version.fileSize.toString(), 10);
      let downloadedSize = 0;
      let lastTime = Date.now();
      let lastDownloaded = 0;

      const writer = fs.createWriteStream(modPath);

      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;

        const now = Date.now();
        const elapsed = now - lastTime;

        if (elapsed >= 100) {
          const speed = ((downloadedSize - lastDownloaded) / elapsed) * 1000;
          onProgress?.({
            type: 'mod',
            name: mod.name,
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

      // VULN-006: Verify file integrity using hashes from API
      if (version.hashes) {
        const hashAlgo = version.hashes.sha512 ? 'sha512' : version.hashes.sha1 ? 'sha1' : null;
        const expectedHash = version.hashes.sha512 || version.hashes.sha1;

        if (hashAlgo && expectedHash) {
          const isValid = await this.verifyFileHash(modPath, expectedHash, hashAlgo);
          if (!isValid) {
            fs.unlinkSync(modPath);
            throw new Error(`Hash mismatch for mod ${mod.name} — file may be corrupted or tampered with`);
          }
          log.info(`Hash verified (${hashAlgo}) for ${mod.name}`);
        }
      } else {
        log.warn(`No hash available for ${mod.name} — skipping verification`);
      }

      // Download dependencies
      const requiredDeps = version.dependencies.filter((d) => d.type === 'required');
      for (const dep of requiredDeps) {
        await this.installDependency(dep, gameVersion, version.loaders[0], onProgress);
      }

      // Record installation with version folder info
      const installedMod: InstalledMod = {
        id: mod.id,
        name: mod.name,
        version: version.versionNumber,
        fileName: version.fileName,
        source: mod.source,
        loader: version.loaders[0] || 'forge',
        gameVersion: gameVersion,
        installedAt: new Date().toISOString(),
        filePath: modPath,
      };

      const installedMods = this.store.get('installedMods');
      const existingIndex = installedMods.findIndex((m) => m.id === mod.id);
      
      if (existingIndex >= 0) {
        installedMods[existingIndex] = installedMod;
      } else {
        installedMods.push(installedMod);
      }
      
      this.store.set('installedMods', installedMods);

      log.info(`Successfully installed ${mod.name}`);
    } catch (error) {
      log.error(`Failed to install mod ${mod.name}:`, error);
      
      // Cleanup on failure
      if (fs.existsSync(modPath)) {
        fs.unlinkSync(modPath);
      }
      
      throw error;
    }
  }

  private async installDependency(
    dep: ModDependency,
    gameVersion: string,
    loader: LoaderType,
    onProgress?: ProgressCallback
  ): Promise<void> {
    log.info(`Installing dependency: ${dep.modId}`);

    try {
      // Check if already installed
      const installedMods = this.store.get('installedMods');
      if (installedMods.some((m) => m.id === dep.modId)) {
        log.info(`Dependency ${dep.modId} already installed`);
        return;
      }

      // Try to find the mod
      let mod: Mod | null = null;
      let version: ModVersion | null = null;

      // Try Modrinth first (project IDs are used)
      try {
        mod = await modrinthAPI.getProject(dep.modId);
        if (mod) {
          const versions = await modrinthAPI.getProjectVersions(dep.modId, gameVersion, loader);
          version = versions[0] || null;
        }
      } catch {
        // Try CurseForge
        try {
          const mods = await curseForgeAPI.getModsByIds([parseInt(dep.modId)]);
          mod = mods[0] || null;
          if (mod) {
            const versions = await curseForgeAPI.getModFiles(parseInt(dep.modId), gameVersion, loader);
            version = versions[0] || null;
          }
        } catch {
          log.warn(`Could not find dependency: ${dep.modId}`);
        }
      }

      if (mod && version) {
        await this.installMod(mod, version, onProgress);
      }
    } catch (error) {
      log.warn(`Failed to install dependency ${dep.modId}:`, error);
    }
  }

  async uninstallMod(modId: string): Promise<void> {
    log.info(`Uninstalling mod: ${modId}`);

    const installedMods = this.store.get('installedMods');
    const modIndex = installedMods.findIndex((m) => m.id === modId);

    if (modIndex < 0) {
      throw new Error('Mod not found');
    }

    const mod = installedMods[modIndex];

    // Delete file
    if (fs.existsSync(mod.filePath)) {
      fs.unlinkSync(mod.filePath);
    }

    // Remove from store
    installedMods.splice(modIndex, 1);
    this.store.set('installedMods', installedMods);

    log.info(`Successfully uninstalled ${mod.name}`);
  }

  async getInstalledMods(): Promise<InstalledMod[]> {
    const installedMods = this.store.get('installedMods');
    
    // Verify files exist
    const validMods = installedMods.filter((mod) => {
      if (!fs.existsSync(mod.filePath)) {
        log.warn(`Mod file missing: ${mod.filePath}`);
        return false;
      }
      return true;
    });

    // Update store if any were removed
    if (validMods.length !== installedMods.length) {
      this.store.set('installedMods', validMods);
    }

    return validMods;
  }

  async checkConflicts(): Promise<ModConflict[]> {
    const conflicts: ModConflict[] = [];
    const installedMods = await this.getInstalledMods();

    // Check for loader mismatches
    const loaders = new Set(installedMods.map((m) => m.loader));
    if (loaders.size > 1 && !loaders.has('vanilla')) {
      const fabricMods = installedMods.filter((m) => m.loader === 'fabric');
      const forgeMods = installedMods.filter((m) => m.loader === 'forge');

      for (const fabricMod of fabricMods) {
        for (const forgeMod of forgeMods) {
          conflicts.push({
            mod1: fabricMod,
            mod2: forgeMod,
            reason: 'Fabric and Forge mods cannot be used together',
          });
        }
      }
    }

    // Check for game version mismatches
    const gameVersions = new Set(installedMods.map((m) => m.gameVersion).filter(Boolean));
    if (gameVersions.size > 1) {
      const versionGroups = new Map<string, InstalledMod[]>();
      
      for (const mod of installedMods) {
        if (!mod.gameVersion) continue;
        const existing = versionGroups.get(mod.gameVersion) || [];
        existing.push(mod);
        versionGroups.set(mod.gameVersion, existing);
      }

      const versions = Array.from(versionGroups.entries());
      for (let i = 0; i < versions.length; i++) {
        for (let j = i + 1; j < versions.length; j++) {
          const [v1, mods1] = versions[i];
          const [v2, mods2] = versions[j];

          for (const m1 of mods1) {
            for (const m2 of mods2) {
              conflicts.push({
                mod1: m1,
                mod2: m2,
                reason: `Game version mismatch: ${v1} vs ${v2}`,
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * VULN-006: Verify file integrity using hash comparison
   */
  private async verifyFileHash(
    filePath: string,
    expectedHash: string,
    algorithm: 'sha1' | 'sha512'
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex') === expectedHash.toLowerCase()));
      stream.on('error', reject);
    });
  }

  async getDependencies(modVersion: ModVersion): Promise<ModDependency[]> {
    return modVersion.dependencies;
  }

  async getModVersionsForGame(
    modId: string,
    source: 'curseforge' | 'modrinth',
    gameVersion: string,
    loader?: LoaderType
  ): Promise<ModVersion[]> {
    try {
      if (source === 'curseforge') {
        return await curseForgeAPI.getModFiles(parseInt(modId), gameVersion, loader);
      } else {
        return await modrinthAPI.getProjectVersions(modId, gameVersion, loader);
      }
    } catch (error) {
      log.error(`Failed to get mod versions for ${modId}:`, error);
      return [];
    }
  }

  clearInstalledMods(): void {
    const installedMods = this.store.get('installedMods');
    
    for (const mod of installedMods) {
      if (fs.existsSync(mod.filePath)) {
        try {
          fs.unlinkSync(mod.filePath);
        } catch (error) {
          log.warn(`Failed to delete mod file: ${mod.filePath}`, error);
        }
      }
    }

    this.store.set('installedMods', []);
    log.info('Cleared all installed mods');
  }

  /**
   * Get installed mods grouped by game version
   */
  async getModsByVersion(): Promise<Map<string, InstalledMod[]>> {
    const installedMods = await this.getInstalledMods();
    const grouped = new Map<string, InstalledMod[]>();

    for (const mod of installedMods) {
      const version = mod.gameVersion || 'unknown';
      const existing = grouped.get(version) || [];
      existing.push(mod);
      grouped.set(version, existing);
    }

    return grouped;
  }

  /**
   * Get available game versions that have mods installed
   */
  async getVersionsWithMods(): Promise<string[]> {
    const grouped = await this.getModsByVersion();
    return Array.from(grouped.keys()).sort((a, b) => {
      // Sort versions newest first
      const partsA = a.split('.').map(n => parseInt(n, 10) || 0);
      const partsB = b.split('.').map(n => parseInt(n, 10) || 0);
      
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const diff = (partsB[i] || 0) - (partsA[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  }

  /**
   * Scan mods folders and discover any untracked mods
   */
  async scanModsFolders(): Promise<{ version: string; files: string[] }[]> {
    const gameDirectory = this.settingsService.getGameDirectory();
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const result: { version: string; files: string[] }[] = [];

    if (!fs.existsSync(modsBaseDir)) {
      return result;
    }

    const entries = fs.readdirSync(modsBaseDir, { withFileTypes: true });
    
    // Check root mods folder
    const rootMods = entries
      .filter(e => e.isFile() && e.name.endsWith('.jar'))
      .map(e => e.name);
    
    if (rootMods.length > 0) {
      result.push({ version: 'root', files: rootMods });
    }

    // Check version-specific folders
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const versionDir = path.join(modsBaseDir, entry.name);
        const versionMods = fs.readdirSync(versionDir)
          .filter(f => f.endsWith('.jar'));
        
        if (versionMods.length > 0) {
          result.push({ version: entry.name, files: versionMods });
        }
      }
    }

    return result;
  }

  /**
   * Copy mods from root folder to version-specific folder
   */
  async organizeMods(targetVersion: string): Promise<void> {
    const gameDirectory = this.settingsService.getGameDirectory();
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const targetDir = path.join(modsBaseDir, targetVersion);

    if (!fs.existsSync(modsBaseDir)) {
      return;
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const entries = fs.readdirSync(modsBaseDir, { withFileTypes: true });
    const installedMods = this.store.get('installedMods');

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jar')) {
        const srcPath = path.join(modsBaseDir, entry.name);
        const destPath = path.join(targetDir, entry.name);

        // Copy file
        fs.copyFileSync(srcPath, destPath);
        
        // Update installed mod record
        const modRecord = installedMods.find(m => m.fileName === entry.name);
        if (modRecord) {
          modRecord.filePath = destPath;
          modRecord.gameVersion = targetVersion;
        }

        // Remove original
        fs.unlinkSync(srcPath);
        
        log.info(`Moved mod ${entry.name} to ${targetVersion} folder`);
      }
    }

    this.store.set('installedMods', installedMods);
  }

  /**
   * Activate mods for a specific version (symlink or copy to root mods folder)
   */
  async activateModsForVersion(version: string): Promise<void> {
    const gameDirectory = this.settingsService.getGameDirectory();
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const versionDir = path.join(modsBaseDir, version);

    if (!fs.existsSync(versionDir)) {
      log.warn(`No mods folder for version ${version}`);
      return;
    }

    // Clear existing root mods (but not version folders)
    const rootEntries = fs.readdirSync(modsBaseDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && entry.name.endsWith('.jar')) {
        fs.unlinkSync(path.join(modsBaseDir, entry.name));
      }
    }

    // Copy version-specific mods to root
    const versionMods = fs.readdirSync(versionDir);
    for (const modFile of versionMods) {
      if (modFile.endsWith('.jar')) {
        const srcPath = path.join(versionDir, modFile);
        const destPath = path.join(modsBaseDir, modFile);
        fs.copyFileSync(srcPath, destPath);
      }
    }

    log.info(`Activated ${versionMods.length} mods for version ${version}`);
  }

  /**
   * Ensure menu customization mods (FancyMenu + Konkrete + Melody) are installed for a version
   */
  async ensureMenuMods(gameVersion: string, loader: LoaderType = 'fabric'): Promise<void> {
    const gameDirectory = this.settingsService.getGameDirectory();
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const versionDir = path.join(modsBaseDir, gameVersion);
    fs.mkdirSync(versionDir, { recursive: true });

    // Check if already installed
    const existingMods = fs.existsSync(versionDir) ? fs.readdirSync(versionDir) : [];
    const hasFancyMenu = existingMods.some(f => f.toLowerCase().includes('fancymenu'));
    const hasKonkrete = existingMods.some(f => f.toLowerCase().includes('konkrete'));
    const hasMelody = existingMods.some(f => f.toLowerCase().includes('melody'));

    if (hasFancyMenu && hasKonkrete && hasMelody) {
      log.info(`Menu mods already installed for ${gameVersion}`);
      return;
    }

    log.info(`Installing menu mods for ${gameVersion}...`);

    try {
      const headers = { 'User-Agent': 'EnderGate/1.0.0' };

      // FancyMenu project ID: Wq5SjeWM, Konkrete: J81TRJWm, Melody: CVT4pFB2
      const modsToInstall = [
        { name: 'FancyMenu', projectId: 'Wq5SjeWM', check: hasFancyMenu },
        { name: 'Konkrete', projectId: 'J81TRJWm', check: hasKonkrete },
        { name: 'Melody', projectId: 'CVT4pFB2', check: hasMelody },
      ];

      for (const mod of modsToInstall) {
        if (mod.check) continue;

        try {
          // Try to find version for exact game version
          let versionsUrl = `https://api.modrinth.com/v2/project/${mod.projectId}/version?loaders=["${loader}"]&game_versions=["${gameVersion}"]`;
          let response = await axios.get(versionsUrl, { headers });
          let versions = response.data;

          // If no exact match, try without game_versions filter and find best match
          if (versions.length === 0) {
            versionsUrl = `https://api.modrinth.com/v2/project/${mod.projectId}/version?loaders=["${loader}"]`;
            response = await axios.get(versionsUrl, { headers });
            versions = response.data;

            // Filter for compatible major version (e.g., 1.21.x matches 1.21, 1.21.1)
            const majorVersion = gameVersion.split('.').slice(0, 2).join('.');
            versions = versions.filter((v: any) => 
              v.game_versions.some((gv: string) => gv.startsWith(majorVersion))
            );
          }

          if (versions.length === 0) {
            log.warn(`No compatible ${mod.name} version found for ${gameVersion}`);
            continue;
          }

          const latestVersion = versions[0];
          const file = latestVersion.files.find((f: any) => f.primary) || latestVersion.files[0];

          if (!file) continue;

          const modPath = path.join(versionDir, file.filename);

          // Download
          log.info(`Downloading ${mod.name}: ${file.filename}`);
          const fileResponse = await axios.get(file.url, {
            headers,
            responseType: 'arraybuffer',
          });

          fs.writeFileSync(modPath, Buffer.from(fileResponse.data));
          log.info(`Installed ${mod.name} for ${gameVersion}`);
        } catch (modError) {
          log.warn(`Failed to install ${mod.name}:`, modError);
        }
      }
    } catch (error) {
      log.error('Failed to install menu mods:', error);
    }
  }

  /**
   * Ensure optimization mods are installed for a version
   * Includes: Sodium, Lithium, FerriteCore, ModernFix, ImmediatelyFast, EntityCulling
   */
  async ensureOptimizationMods(gameVersion: string, loader: LoaderType = 'fabric'): Promise<void> {
    if (loader !== 'fabric') {
      log.info('Optimization mods only supported for Fabric currently');
      return;
    }

    const gameDirectory = this.settingsService.getGameDirectory();
    const modsBaseDir = path.join(gameDirectory, 'mods');
    const versionDir = path.join(modsBaseDir, gameVersion);
    fs.mkdirSync(versionDir, { recursive: true });

    // Check existing mods
    const existingMods = fs.existsSync(versionDir) ? fs.readdirSync(versionDir) : [];
    const existingLower = existingMods.map(f => f.toLowerCase());

    // Optimization mods with their Modrinth project IDs
    // Note: ModernFix removed due to compatibility issues with newer MC versions
    const optimizationMods = [
      { name: 'Sodium', projectId: 'AANobbMI', pattern: 'sodium' },
      { name: 'Lithium', projectId: 'gvQqBUqZ', pattern: 'lithium' },
      { name: 'FerriteCore', projectId: 'uXXizFIs', pattern: 'ferritecore' },
      { name: 'ImmediatelyFast', projectId: '5ZwdcRci', pattern: 'immediatelyfast' },
      { name: 'EntityCulling', projectId: 'NNAgCjsB', pattern: 'entityculling' },
    ];

    const modsToInstall = optimizationMods.filter(
      mod => !existingLower.some(f => f.includes(mod.pattern))
    );

    if (modsToInstall.length === 0) {
      log.info(`All optimization mods already installed for ${gameVersion}`);
      return;
    }

    log.info(`Installing ${modsToInstall.length} optimization mods for ${gameVersion}...`);

    const headers = { 'User-Agent': 'EnderGate/1.0.0' };

    for (const mod of modsToInstall) {
      try {
        // Try exact game version first
        let versionsUrl = `https://api.modrinth.com/v2/project/${mod.projectId}/version?loaders=["${loader}"]&game_versions=["${gameVersion}"]`;
        let response = await axios.get(versionsUrl, { headers });
        let versions = response.data;

        // If no exact match, try major version (e.g., 1.21.x -> 1.21)
        if (versions.length === 0) {
          versionsUrl = `https://api.modrinth.com/v2/project/${mod.projectId}/version?loaders=["${loader}"]`;
          response = await axios.get(versionsUrl, { headers });
          versions = response.data;

          const majorVersion = gameVersion.split('.').slice(0, 2).join('.');
          versions = versions.filter((v: any) =>
            v.game_versions.some((gv: string) => gv.startsWith(majorVersion))
          );
        }

        if (versions.length === 0) {
          log.warn(`No compatible ${mod.name} version found for ${gameVersion}`);
          continue;
        }

        const latestVersion = versions[0];
        const file = latestVersion.files.find((f: any) => f.primary) || latestVersion.files[0];

        if (!file) continue;

        const modPath = path.join(versionDir, file.filename);

        // Skip if already exists
        if (fs.existsSync(modPath)) {
          log.info(`${mod.name} already exists, skipping`);
          continue;
        }

        log.info(`Downloading ${mod.name}: ${file.filename}`);
        const fileResponse = await axios.get(file.url, {
          headers,
          responseType: 'arraybuffer',
        });

        fs.writeFileSync(modPath, Buffer.from(fileResponse.data));
        log.info(`Installed ${mod.name} for ${gameVersion}`);
      } catch (modError) {
        log.warn(`Failed to install ${mod.name}:`, modError);
      }
    }
  }
}
