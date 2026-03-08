import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

import { FABRIC_API_URL, LOADER_CACHE_TTL } from '../shared/constants';
import type { FabricLoaderVersion, LoaderVersion } from '../shared/types';

interface FabricGameVersion {
  version: string;
  stable: boolean;
}

interface FabricLoaderInfo {
  separator: string;
  build: number;
  maven: string;
  version: string;
  stable: boolean;
}

interface FabricInstallerVersion {
  url: string;
  maven: string;
  version: string;
  stable: boolean;
}

interface FabricCache {
  gameVersions: FabricGameVersion[];
  loaderVersions: FabricLoaderInfo[];
  lastFetch: number;
}

export class FabricAPI {
  private client: AxiosInstance;
  private cache: FabricCache = {
    gameVersions: [],
    loaderVersions: [],
    lastFetch: 0,
  };

  constructor() {
    this.client = axios.create({
      baseURL: FABRIC_API_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'EnderGate/1.0.0',
      },
    });
  }

  async getGameVersions(): Promise<FabricGameVersion[]> {
    if (
      this.cache.gameVersions.length > 0 &&
      Date.now() - this.cache.lastFetch < LOADER_CACHE_TTL
    ) {
      return this.cache.gameVersions;
    }

    try {
      const response = await this.client.get<FabricGameVersion[]>('/versions/game');
      this.cache.gameVersions = response.data;
      this.cache.lastFetch = Date.now();
      return response.data;
    } catch (error) {
      log.error('Failed to fetch Fabric game versions:', error);
      throw new Error('Failed to fetch Fabric game versions');
    }
  }

  async getLoaderVersions(): Promise<FabricLoaderInfo[]> {
    if (
      this.cache.loaderVersions.length > 0 &&
      Date.now() - this.cache.lastFetch < LOADER_CACHE_TTL
    ) {
      return this.cache.loaderVersions;
    }

    try {
      const response = await this.client.get<FabricLoaderInfo[]>('/versions/loader');
      this.cache.loaderVersions = response.data;
      return response.data;
    } catch (error) {
      log.error('Failed to fetch Fabric loader versions:', error);
      throw new Error('Failed to fetch Fabric loader versions');
    }
  }

  async getLoaderForGameVersion(minecraftVersion: string): Promise<FabricLoaderVersion[]> {
    try {
      const response = await this.client.get<FabricLoaderVersion[]>(
        `/versions/loader/${minecraftVersion}`
      );
      return response.data;
    } catch (error) {
      log.error(`Failed to fetch Fabric loader for ${minecraftVersion}:`, error);
      return [];
    }
  }

  async isVersionSupported(minecraftVersion: string): Promise<boolean> {
    try {
      const gameVersions = await this.getGameVersions();
      return gameVersions.some((v) => v.version === minecraftVersion);
    } catch {
      return false;
    }
  }

  async getLatestLoaderVersion(): Promise<string | null> {
    try {
      const loaders = await this.getLoaderVersions();
      const stable = loaders.find((l) => l.stable);
      return stable?.version || loaders[0]?.version || null;
    } catch {
      return null;
    }
  }

  async getInstallerVersions(): Promise<FabricInstallerVersion[]> {
    try {
      const response = await this.client.get<FabricInstallerVersion[]>('/versions/installer');
      return response.data;
    } catch (error) {
      log.error('Failed to fetch Fabric installer versions:', error);
      throw new Error('Failed to fetch Fabric installer versions');
    }
  }

  async getLoaderProfile(
    minecraftVersion: string,
    loaderVersion: string
  ): Promise<FabricLoaderVersion | null> {
    try {
      const response = await this.client.get<FabricLoaderVersion>(
        `/versions/loader/${minecraftVersion}/${loaderVersion}`
      );
      return response.data;
    } catch (error) {
      log.error(`Failed to get Fabric profile for ${minecraftVersion}/${loaderVersion}:`, error);
      return null;
    }
  }

  convertToLoaderVersion(
    fabricLoader: FabricLoaderVersion,
    minecraftVersion: string
  ): LoaderVersion {
    return {
      loader: 'fabric',
      version: fabricLoader.loader.version,
      minecraftVersion,
      stable: fabricLoader.loader.stable,
    };
  }

  clearCache(): void {
    this.cache.gameVersions = [];
    this.cache.loaderVersions = [];
    this.cache.lastFetch = 0;
  }
}

export const fabricAPI = new FabricAPI();
