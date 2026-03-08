import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

import { NEOFORGE_API_URL, NEOFORGE_MAVEN_URL, LOADER_CACHE_TTL } from '../shared/constants';
import type { NeoForgeVersion, LoaderVersion } from '../shared/types';

interface NeoForgeVersionsResponse {
  isSnapshot: boolean;
  versions: string[];
}

interface NeoForgeCache {
  versions: string[];
  lastFetch: number;
}

export class NeoForgeAPI {
  private client: AxiosInstance;
  private cache: NeoForgeCache = {
    versions: [],
    lastFetch: 0,
  };

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'EnderGate/1.0.0',
      },
    });
  }

  async getAllVersions(): Promise<string[]> {
    if (
      this.cache.versions.length > 0 &&
      Date.now() - this.cache.lastFetch < LOADER_CACHE_TTL
    ) {
      return this.cache.versions;
    }

    try {
      const response = await this.client.get<NeoForgeVersionsResponse>(NEOFORGE_API_URL);
      this.cache.versions = response.data.versions;
      this.cache.lastFetch = Date.now();
      return response.data.versions;
    } catch (error) {
      log.error('Failed to fetch NeoForge versions:', error);
      throw new Error('Failed to fetch NeoForge versions');
    }
  }

  async getVersionsForMinecraft(minecraftVersion: string): Promise<NeoForgeVersion[]> {
    try {
      const allVersions = await this.getAllVersions();
      
      // NeoForge version format: mcVersion.x.y or mcVersion-xyz
      // For MC 1.20.1, NeoForge versions look like: 47.1.x (Forge-like) or 20.1.x (new format)
      const mcParts = minecraftVersion.split('.');
      const minorVersion = mcParts.length >= 2 ? `${mcParts[1]}.${mcParts[2] || '0'}` : minecraftVersion;

      const matchingVersions: NeoForgeVersion[] = [];

      for (const version of allVersions) {
        // New NeoForge format: 20.4.x for MC 1.20.4
        if (version.startsWith(minorVersion.replace('.', '')) || version.startsWith(minorVersion)) {
          matchingVersions.push({
            version,
            minecraftVersion,
            stable: !version.includes('beta') && !version.includes('alpha'),
          });
        }
      }

      // Sort by version descending
      matchingVersions.sort((a, b) => {
        const aParts = a.version.split('.').map(v => parseInt(v) || 0);
        const bParts = b.version.split('.').map(v => parseInt(v) || 0);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
      });

      return matchingVersions;
    } catch (error) {
      log.error(`Failed to get NeoForge versions for ${minecraftVersion}:`, error);
      return [];
    }
  }

  async isVersionSupported(minecraftVersion: string): Promise<boolean> {
    try {
      const versions = await this.getVersionsForMinecraft(minecraftVersion);
      return versions.length > 0;
    } catch {
      return false;
    }
  }

  async getLatestVersion(minecraftVersion: string): Promise<string | null> {
    try {
      const versions = await this.getVersionsForMinecraft(minecraftVersion);
      const stable = versions.find(v => v.stable);
      return stable?.version || versions[0]?.version || null;
    } catch {
      return null;
    }
  }

  getInstallerUrl(neoForgeVersion: string): string {
    return `${NEOFORGE_MAVEN_URL}/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`;
  }

  convertToLoaderVersion(neoForgeVersion: NeoForgeVersion): LoaderVersion {
    return {
      loader: 'neoforge',
      version: neoForgeVersion.version,
      minecraftVersion: neoForgeVersion.minecraftVersion,
      stable: neoForgeVersion.stable,
    };
  }

  async getSupportedMinecraftVersions(): Promise<string[]> {
    try {
      const allVersions = await this.getAllVersions();
      const mcVersions = new Set<string>();

      for (const version of allVersions) {
        // Extract MC version from NeoForge version
        const parts = version.split('.');
        if (parts.length >= 2) {
          // New format: 20.4.x -> 1.20.4
          const major = parseInt(parts[0]);
          const minor = parseInt(parts[1]);
          if (major >= 20) {
            mcVersions.add(`1.${major}.${minor}`);
          }
        }
      }

      return Array.from(mcVersions).sort((a, b) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
      });
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.cache.versions = [];
    this.cache.lastFetch = 0;
  }
}

export const neoForgeAPI = new NeoForgeAPI();
