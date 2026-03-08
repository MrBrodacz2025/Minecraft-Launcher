import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

import { FORGE_MAVEN_URL, LOADER_CACHE_TTL } from '../shared/constants';
import type { ForgeVersion, LoaderVersion } from '../shared/types';

interface ForgeVersionInfo {
  mcversion: string;
  version: string;
  build: number;
  branch?: string;
  modified: number;
  filename: string;
  md5: string;
}

interface ForgePromotions {
  homepage: string;
  promos: Record<string, string>;
}

interface ForgeCache {
  versions: Map<string, ForgeVersionInfo[]>;
  promotions: ForgePromotions | null;
  lastFetch: number;
}

export class ForgeAPI {
  private client: AxiosInstance;
  private cache: ForgeCache = {
    versions: new Map(),
    promotions: null,
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

  async getPromotions(): Promise<ForgePromotions> {
    if (
      this.cache.promotions &&
      Date.now() - this.cache.lastFetch < LOADER_CACHE_TTL
    ) {
      return this.cache.promotions;
    }

    try {
      const response = await this.client.get<ForgePromotions>(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
      );
      this.cache.promotions = response.data;
      this.cache.lastFetch = Date.now();
      return response.data;
    } catch (error) {
      log.error('Failed to fetch Forge promotions:', error);
      throw new Error('Failed to fetch Forge promotions');
    }
  }

  async getVersionsForMinecraft(minecraftVersion: string): Promise<ForgeVersion[]> {
    try {
      const promotions = await this.getPromotions();
      const versions: ForgeVersion[] = [];

      // Parse promotions to get available versions
      for (const [key, forgeVersion] of Object.entries(promotions.promos)) {
        const [mcVersion, type] = key.split('-');
        
        if (mcVersion === minecraftVersion) {
          const exists = versions.find(v => v.version === forgeVersion);
          if (!exists) {
            versions.push({
              version: forgeVersion,
              minecraftVersion,
              recommended: type === 'recommended',
              latest: type === 'latest',
            });
          } else {
            if (type === 'recommended') exists.recommended = true;
            if (type === 'latest') exists.latest = true;
          }
        }
      }

      return versions;
    } catch (error) {
      log.error(`Failed to get Forge versions for ${minecraftVersion}:`, error);
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

  async getRecommendedVersion(minecraftVersion: string): Promise<string | null> {
    try {
      const promotions = await this.getPromotions();
      const key = `${minecraftVersion}-recommended`;
      return promotions.promos[key] || null;
    } catch {
      return null;
    }
  }

  async getLatestVersion(minecraftVersion: string): Promise<string | null> {
    try {
      const promotions = await this.getPromotions();
      const key = `${minecraftVersion}-latest`;
      return promotions.promos[key] || null;
    } catch {
      return null;
    }
  }

  getInstallerUrl(minecraftVersion: string, forgeVersion: string): string {
    const fullVersion = `${minecraftVersion}-${forgeVersion}`;
    return `${FORGE_MAVEN_URL}/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
  }

  getUniversalUrl(minecraftVersion: string, forgeVersion: string): string {
    const fullVersion = `${minecraftVersion}-${forgeVersion}`;
    return `${FORGE_MAVEN_URL}/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-universal.jar`;
  }

  convertToLoaderVersion(forgeVersion: ForgeVersion): LoaderVersion {
    return {
      loader: 'forge',
      version: forgeVersion.version,
      minecraftVersion: forgeVersion.minecraftVersion,
      stable: forgeVersion.recommended,
    };
  }

  async getSupportedMinecraftVersions(): Promise<string[]> {
    try {
      const promotions = await this.getPromotions();
      const versions = new Set<string>();

      for (const key of Object.keys(promotions.promos)) {
        const mcVersion = key.split('-')[0];
        versions.add(mcVersion);
      }

      return Array.from(versions).sort((a, b) => {
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
    this.cache.versions.clear();
    this.cache.promotions = null;
    this.cache.lastFetch = 0;
  }
}

export const forgeAPI = new ForgeAPI();
